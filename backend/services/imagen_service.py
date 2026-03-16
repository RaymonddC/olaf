"""OLAF — Vertex AI Imagen 3 service for illustration generation.

Generates warm, watercolor-style illustrations for memory chapters and
health narratives. Uploads results to Cloud Storage with permanent public URLs.
"""

import logging
import os
import pathlib
import uuid

logger = logging.getLogger(__name__)

# Art direction constants
ART_DIRECTION = (
    "Warm watercolor illustration, soft pastel colors, gentle diffused lighting, "
    "cozy and nostalgic atmosphere, suitable for elderly viewers, no text overlay, "
    "no harsh shadows, hand-painted feel"
)

BUCKET_NAME = os.getenv("GCS_ARTIFACTS_BUCKET", "olaf-artifacts")
LOCAL_STATIC_DIR = pathlib.Path(__file__).parent.parent / "static" / "images"
LOCAL_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8080")


class ImagenService:
    """Vertex AI Imagen 3 client for generating and storing illustrations."""

    def __init__(self) -> None:
        self._genai_client = None
        self._storage_client = None

    @property
    def genai_client(self):
        if self._genai_client is None:
            from google import genai

            self._genai_client = genai.Client()
        return self._genai_client

    @property
    def storage_client(self):
        if self._storage_client is None:
            try:
                from google.cloud import storage
                self._storage_client = storage.Client()
            except Exception:
                self._storage_client = None
        return self._storage_client

    async def generate_illustration(
        self,
        prompt: str,
        style: str = "warm watercolor",
        aspect_ratio: str = "4:3",
    ) -> bytes:
        """Generate an illustration using Imagen 3.

        Args:
            prompt: Scene description for the illustration.
            style: Art style modifier.
            aspect_ratio: Image aspect ratio (4:3 for cards, 16:9 for reports).

        Returns:
            Raw PNG image bytes.

        Raises:
            ImageGenerationError: If generation fails or is filtered.
        """
        from google.genai.types import GenerateImagesConfig

        full_prompt = f"{prompt}. {ART_DIRECTION}, {style} style"

        try:
            response = self.genai_client.models.generate_images(
                model="imagen-3.0-generate-002",
                prompt=full_prompt,
                config=GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio=aspect_ratio,
                    safety_filter_level="block_medium_and_above",
                    person_generation="allow_adult",
                ),
            )

            if response.generated_images:
                return response.generated_images[0].image._image_bytes

            raise ImageGenerationError("Image generation returned no results (possibly filtered)")

        except ImageGenerationError:
            raise
        except Exception as e:
            logger.error("Imagen generation failed: %s", e)
            raise ImageGenerationError(f"Image generation failed: {e}") from e

    def upload_to_storage(
        self,
        image_bytes: bytes,
        user_id: str,
        filename: str | None = None,
    ) -> str:
        """Upload image bytes — tries GCS first, falls back to local static dir.

        Args:
            image_bytes: Raw image data.
            user_id: Owner user ID (used for path partitioning).
            filename: Optional filename; auto-generated if omitted.

        Returns:
            Permanent public URL for the uploaded image.
        """
        if not filename:
            ext = "jpg" if image_bytes[:3] == b"\xff\xd8\xff" else "png"
            filename = f"{uuid.uuid4().hex[:16]}.{ext}"

        # ── Try GCS first ────────────────────────────────────────────────
        if self.storage_client is not None:
            try:
                blob_name = f"illustrations/{user_id}/{filename}"
                bucket = self.storage_client.bucket(BUCKET_NAME)
                blob = bucket.blob(blob_name)
                content_type = "image/jpeg" if filename.endswith(".jpg") else "image/png"
                blob.upload_from_string(image_bytes, content_type=content_type)
                # Bucket uses uniform IAM (allUsers=objectViewer), no per-object ACL needed
                public_url = f"https://storage.googleapis.com/{BUCKET_NAME}/{blob_name}"
                logger.info("Uploaded to GCS: %s", public_url)
                return public_url
            except Exception as e:
                logger.warning("GCS upload failed (%s), falling back to local storage", e)

        # ── Local static file fallback (dev) ─────────────────────────────
        LOCAL_STATIC_DIR.mkdir(parents=True, exist_ok=True)
        local_path = LOCAL_STATIC_DIR / filename
        local_path.write_bytes(image_bytes)
        url = f"{LOCAL_BASE_URL}/static/images/{filename}"
        logger.info("Saved image locally: %s", url)
        return url

    async def generate_nano_banana_recap(
        self,
        narrative: str,
        user_id: str,
        api_key: str | None = None,
    ) -> str:
        """Generate a Nano Banana (Gemini image generation) day-recap illustration.

        Uses gemini-2.5-flash-image via the REST API to create a warm artistic
        recap of the elder's day based on their memory narrative.

        Returns:
            Permanent public URL to the stored image.

        Raises:
            ImageGenerationError: If generation fails.
        """
        import base64

        import httpx

        key = api_key or os.getenv("GOOGLE_API_KEY", "")
        if not key:
            raise ImageGenerationError("No GOOGLE_API_KEY set for Nano Banana")

        prompt = (
            "Create a warm watercolor-style illustration of a specific scene from an elderly "
            "person's day. Paint exactly what they described — the actual place, activity, "
            "or moment from their story. Make it personal and specific, not generic. "
            "Style: soft pastel colors, gentle and natural, like a personal journal illustration. "
            "No text or letters in the image.\n\n"
            f"Scene from their day: {narrative[:600]}"
        )

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
                    headers={"x-goog-api-key": key},
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"responseModalities": ["IMAGE"]},
                    },
                    timeout=60,
                )

            if resp.status_code != 200:
                raise ImageGenerationError(f"Nano Banana API returned {resp.status_code}: {resp.text[:200]}")

            data = resp.json()
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            image_b64: str | None = None
            for part in parts:
                if "inlineData" in part:
                    image_b64 = part["inlineData"]["data"]
                    break

            if not image_b64:
                raise ImageGenerationError("Nano Banana returned no image data")

            image_bytes = base64.b64decode(image_b64)
            url = self.upload_to_storage(image_bytes, user_id)
            logger.info("Nano Banana recap generated for user=%s url=%s", user_id, url)
            return url

        except ImageGenerationError:
            raise
        except Exception as e:
            logger.error("Nano Banana generation failed: %s", e)
            raise ImageGenerationError(f"Nano Banana generation failed: {e}") from e

    async def generate_and_store(
        self,
        prompt: str,
        user_id: str,
        style: str = "warm watercolor",
        aspect_ratio: str = "4:3",
    ) -> str:
        """Generate an illustration and store it in Cloud Storage.

        Args:
            prompt: Scene description.
            user_id: Owner user ID.
            style: Art style.
            aspect_ratio: Image aspect ratio.

        Returns:
            Permanent public URL to the stored image.
        """
        image_bytes = await self.generate_illustration(prompt, style, aspect_ratio)
        url = self.upload_to_storage(image_bytes, user_id)
        logger.info("Generated and stored illustration for user=%s url=%s", user_id, url)
        return url


class ImageGenerationError(Exception):
    """Raised when Imagen fails to generate an image."""


# Singleton
_service: ImagenService | None = None


def get_imagen_service() -> ImagenService:
    """Return singleton ImagenService instance."""
    global _service
    if _service is None:
        _service = ImagenService()
    return _service
