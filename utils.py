import asyncio


async def await_callback(api_func, timeout=5):
    loop = asyncio.get_running_loop()
    fut = loop.create_future()

    def cb(evt):
        if not fut.done():
            fut.set_result(evt)

    api_func(cb)
    return await asyncio.wait_for(fut, timeout)


def error_message(provider: str, message: str) -> dict:
    return {
        "type": "error",
        "provider": provider,
        "error_message": message,
    }


def make_part(
    text: str,
    is_final: bool = True,
    speaker: int = None,
    language: str = None,
    start_ms: int = None,
    end_ms: int = None,
    confidence: float = 1.0,
    translation_status: str = None,
) -> dict:
    return {
        "text": text,
        "is_final": is_final,
        "speaker": speaker,
        "language": language,
        "translation_status": translation_status,
        "confidence": confidence,
        "start_ms": start_ms,
        "end_ms": end_ms,
    }
