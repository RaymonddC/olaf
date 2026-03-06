"""OLAF — Vertex AI Imagen 3 service for illustration generation.

Generates warm, watercolor-style illustrations for memory chapters and
health narratives. Uploads results to Cloud Storage with permanent public URLs.
"""

import logging
import os
import uuid

from google.cloud import storage

logger = logging.getLogger(__name__)

# Art direction constants
ART_DIRECTION = (
    "Warm watercolor illustration, soft pastel colors, gentle diffused lighting, "
    "cozy and nostalgic atmosphere, suitable for elderly viewers, no text overlay, "
    "no harsh shadows, hand-painted feel"
)

BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "olaf-artifacts")


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
            self._storage_client = storage.Client()
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
                    add_watermark=False,
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
        """Upload image bytes to Cloud Storage and return a permanent public URL.

        Args:
            image_bytes: Raw image data.
            user_id: Owner user ID (used for path partitioning).
            filename: Optional filename; auto-generated if omitted.

        Returns:
            Permanent public URL for the uploaded image.
        """
        if not filename:
            filename = f"{uuid.uuid4().hex[:16]}.png"

        blob_name = f"illustrations/{user_id}/{filename}"

        bucket = self.storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(blob_name)
        blob.upload_from_string(image_bytes, content_type="image/png")

        # Make publicly readable for permanent URL (no expiry)
        blob.make_public()
        return blob.public_url

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
