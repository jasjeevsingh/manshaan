"""
OpenRouter via OpenAI-compatible Chat Completions API.
"""

import logging
from typing import Any, Optional

from openai import AsyncOpenAI, BadRequestError

from ..config import get_settings, Settings

logger = logging.getLogger(__name__)


def get_openrouter_client(settings: Optional[Settings] = None) -> AsyncOpenAI:
    """Build AsyncOpenAI client pointed at OpenRouter with optional attribution headers."""
    s = settings or get_settings()
    if not s.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    default_headers: dict[str, str] = {}
    if s.openrouter_http_referer:
        default_headers["HTTP-Referer"] = s.openrouter_http_referer
    if s.openrouter_app_title:
        default_headers["X-Title"] = s.openrouter_app_title

    base = s.openrouter_base_url.rstrip("/")
    return AsyncOpenAI(
        api_key=s.openrouter_api_key,
        base_url=base,
        default_headers=default_headers or None,
    )


async def chat_text_complete(
    client: AsyncOpenAI,
    *,
    model: str,
    messages: list[dict[str, Any]],
    temperature: Optional[float] = 0.7,
    response_format: Optional[dict[str, str]] = None,
) -> str:
    """
    Return assistant text from a chat completion.
    If response_format json_object is rejected by the model, retries once without it.
    """
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature
    if response_format is not None:
        kwargs["response_format"] = response_format

    try:
        response = await client.chat.completions.create(**kwargs)
    except BadRequestError as e:
        if response_format is not None:
            logger.warning(
                "Chat completion with response_format rejected (%s); retrying without json mode",
                e,
            )
            kwargs.pop("response_format", None)
            response = await client.chat.completions.create(**kwargs)
        else:
            raise

    choice = response.choices[0].message
    if not choice.content:
        return ""
    return choice.content
