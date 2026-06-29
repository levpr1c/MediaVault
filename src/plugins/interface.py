"""BasePlugin — абстрактный базовый класс для плагинов MediaVault.

Каждый плагин должен:
1. Наследоваться от BasePlugin
2. Реализовать все абстрактные методы
3. Предоставить plugin.json с метаданными
"""

from abc import ABC, abstractmethod
from typing import Any


class BasePlugin(ABC):
    """Базовый интерфейс плагина для MediaVault.

    Плагин загружается PluginManager-ом при старте MediaVault.
    После загрузки вызывается initialize(app) для регистрации роутов.
    """

    @abstractmethod
    def initialize(self, app: Any) -> None:
        """Зарегистрировать роуты и инициализировать плагин.

        Вызывается PluginManager-ом после загрузки плагина.
        В этом методе плагин добавляет свои эндпоинты к Flask-приложению.

        Args:
            app: Flask-приложение MediaVault.
        """
        ...

    @abstractmethod
    def get_metadata(self) -> dict:
        """Вернуть метаданные плагина.

        Returns:
            dict с ключами: name, version, author, description, icon (опционально)
        """
        ...

    @abstractmethod
    def get_settings_schema(self) -> dict:
        """Вернуть JSON Schema настроек плагина.

        Используется для генерации формы настроек на /admin.

        Returns:
            JSON Schema dict (см. https://json-schema.org/)
        """
        ...

    # ─── API методы (рекомендуемые, но опциональные) ───

    def search(self, query: str, page: int = 1, **kwargs) -> dict:
        """Поиск контента.

        Args:
            query: Поисковый запрос.
            page: Номер страницы.

        Returns:
            dict с результатами поиска.
        """
        raise NotImplementedError

    def get_details(self, id_or_url: str) -> dict:
        """Получить детальную информацию.

        Args:
            id_or_url: ID или URL контента.

        Returns:
            dict с деталями.
        """
        raise NotImplementedError

    def download(self, id_or_url: str) -> dict:
        """Получить ссылки/данные для скачивания.

        Args:
            id_or_url: ID или URL контента.

        Returns:
            dict с данными для скачивания.
        """
        raise NotImplementedError
