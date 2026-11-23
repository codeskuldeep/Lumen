from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class Source:
    url: str
    title: str | None = None


@dataclass
class RawAnswer:
    text: str
    sources: list[Source] = field(default_factory=list)
    cost_usd: float = 0.0


class Engine(ABC):
    name: str
    is_mock: bool = False

    @abstractmethod
    async def run(self, prompt: str) -> RawAnswer: ...
