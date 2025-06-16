from abc import ABC, abstractmethod
from typing import List, Dict, Any
from providers.config import ProviderConfig, SupportedFeatures, FeatureState


DEBUG = True  # Whether to log connected providers


class BaseProvider(ABC):
    """
    Abstract base class for all STT/MT providers.
    """

    def __init__(self, config: ProviderConfig):
        self._is_connected = False
        self.error: Exception | None = None
        self.config: ProviderConfig = config

    def log_connected(self):
        if DEBUG:
            print(
                f"\n\nCONNECTED: {self.__class__.__name__}: {self.config.model_dump_json(indent=2)}"
            )

    def is_connected(self) -> bool:
        return self._is_connected

    def validate_provider_capabilities(self, name: str) -> None:
        """
        Check if provider supports the given ProviderParams.
        Raise ProviderError on any unsupported feature.
        """
        validate_capabilities(self.get_available_features(), self.config, name)

    @abstractmethod
    async def connect(self) -> None:
        """
        Establish a connection to the provider.
        """
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """
        Close connection and clean up resources.
        """
        pass

    @abstractmethod
    async def send(self, data: bytes | str) -> None:
        """
        Send an audio chunk or string to the provider.
        """
        pass

    @abstractmethod
    async def send_end(self) -> None:
        """
        Send an end-of-stream signal to the provider.
        This is optional and may not be implemented by all providers.
        """
        pass

    @abstractmethod
    async def receive(self) -> List[Dict[str, Any]]:
        """
        Receive transcription or translation data.
        Should return a list of dictionaries.
        """
        pass

    @staticmethod
    @abstractmethod
    def get_available_features() -> SupportedFeatures:
        """
        Get supported features for each model.
        """
        pass


class ProviderError(Exception):
    """Base error for all provider-related exceptions."""

    def __init__(self, message, details=None):
        self.message = message
        self.details = details
        super().__init__(message)


def validate_capabilities(
    features: SupportedFeatures, config: ProviderConfig, provider: str
) -> None:
    """
    Common validation logic for all providers.
    Raises ProviderError if a required capability is not supported.
    """

    if (
        config.params.mode == "mt"
        and features.translation_one_way.state == FeatureState.UNSUPPORTED
    ):
        raise ProviderError(f"Machine translation is not supported by {provider}.")

    if (
        config.params.mode == "mt" and config.params.translation.type == "two_way"
    ) and features.translation_two_way.state != FeatureState.SUPPORTED:
        raise ProviderError(
            f"Two way machine translation is not supported by {provider}."
        )

    if (
        config.params.enable_speaker_diarization
        and features.speaker_diarization.state == FeatureState.UNSUPPORTED
    ):
        raise ProviderError(f"Speaker diarization not supported by {provider}.")

    if (
        config.params.enable_language_identification
        and features.language_identification.state == FeatureState.UNSUPPORTED
    ):
        raise ProviderError(f"Language identification not supported by {provider}.")

    if (
        config.params.enable_endpoint_detection
        and features.endpoint_detection.state == FeatureState.UNSUPPORTED
    ):
        raise ProviderError(f"Endpoint detection not supported by {provider}.")
