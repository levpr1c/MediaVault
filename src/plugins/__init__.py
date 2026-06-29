"""PluginManager — загрузчик плагинов для MediaVault.

MediaVault core содержит только PluginManager.
Плагины живут в папке plugins/ и НЕ являются частью MediaVault.
"""

import importlib.util
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any

from .interface import BasePlugin

logger = logging.getLogger(__name__)


class PluginManager:
    """Менеджер плагинов MediaVault.

    Сканирует папку plugins/, загружает плагины и управляет их жизненным циклом.
    """

    def __init__(self, plugins_dir: str | Path):
        self.plugins_dir = Path(plugins_dir)
        self._plugins: dict[str, BasePlugin] = {}
        self._metadata: dict[str, dict] = {}

    def discover(self) -> list[dict]:
        """Найти все плагины в папке plugins/.

        Ищет подпапки с plugin.json, читает метаданные.
        Не загружает плагины — только возвращает список.

        Returns:
            Список dict с метаданными найденных плагинов.
        """
        discovered = []
        if not self.plugins_dir.exists():
            logger.warning("Папка плагинов не найдена: %s", self.plugins_dir)
            return discovered

        for entry in sorted(self.plugins_dir.iterdir()):
            if not entry.is_dir():
                continue
            meta_file = entry / "plugin.json"
            if not meta_file.exists():
                continue

            try:
                with open(meta_file, encoding="utf-8") as f:
                    meta = json.load(f)
                meta["_path"] = str(entry)
                discovered.append(meta)
            except (json.JSONDecodeError, OSError) as e:
                logger.error("Ошибка чтения %s: %s", meta_file, e)

        return discovered

    def load_plugin(self, plugin_name: str) -> BasePlugin | None:
        """Загрузить плагин по имени.

        Ищет папку plugins/<plugin_name>/plugin.py,
        импортирует класс-наследник BasePlugin.

        Args:
            plugin_name: Имя плагина (совпадает с именем папки).

        Returns:
            Экземпляр BasePlugin или None.
        """
        plugin_dir = self.plugins_dir / plugin_name
        if not plugin_dir.is_dir():
            logger.error("Папка плагина не найдена: %s", plugin_dir)
            return None

        plugin_file = plugin_dir / "plugin.py"
        if not plugin_file.exists():
            logger.error("plugin.py не найден в %s", plugin_dir)
            return None

        spec = importlib.util.spec_from_file_location(
            f"plugins.{plugin_name}", plugin_file
        )
        if not spec or not spec.loader:
            logger.error("Не удалось загрузить spec для %s", plugin_name)
            return None

        module = importlib.util.module_from_spec(spec)
        sys.modules[f"plugins.{plugin_name}"] = module
        # Добавляем plugin_dir в sys.path, чтобы импорты внутри плагина
        # (например from h_chan.parsers.scraper import ...) работали
        sys.path.insert(0, str(plugin_dir))
        spec.loader.exec_module(module)
        sys.path.remove(str(plugin_dir))

        plugin_class = None
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if (
                isinstance(attr, type)
                and issubclass(attr, BasePlugin)
                and attr is not BasePlugin
            ):
                plugin_class = attr
                break

        if not plugin_class:
            logger.error(
                "В %s не найден класс-наследник BasePlugin", plugin_file
            )
            return None

        instance = plugin_class()
        self._plugins[plugin_name] = instance
        logger.info("Плагин '%s' загружен: %s", plugin_name, type(instance).__name__)

        meta_file = plugin_dir / "plugin.json"
        if meta_file.exists():
            try:
                with open(meta_file, encoding="utf-8") as f:
                    self._metadata[plugin_name] = json.load(f)
            except (json.JSONDecodeError, OSError):
                self._metadata[plugin_name] = {}

        return instance

    def load_all(self, app: Any) -> dict[str, BasePlugin]:
        """Загрузить все плагины и проинициализировать.

        Вызывается при старте MediaVault.

        Args:
            app: Flask-приложение.

        Returns:
            dict {имя_плагина: экземпляр}.
        """
        discovered = self.discover()
        loaded = {}

        for meta in discovered:
            name = meta.get("name") or Path(meta["_path"]).name
            instance = self.load_plugin(name)
            if instance:
                try:
                    instance.initialize(app)
                    loaded[name] = instance
                except Exception as e:
                    logger.error(
                        "Ошибка инициализации плагина '%s': %s", name, e
                    )

        return loaded

    def get_plugin(self, name: str) -> BasePlugin | None:
        """Получить загруженный плагин по имени."""
        return self._plugins.get(name)

    def get_metadata(self, name: str) -> dict:
        """Получить метаданные плагина."""
        return self._metadata.get(name, {})

    def list_loaded(self) -> list[dict]:
        """Список загруженных плагинов с метаданными."""
        return [
            {
                "name": name,
                "metadata": self._metadata.get(name, {}),
                "methods": self._get_plugin_methods(plugin),
            }
            for name, plugin in self._plugins.items()
        ]

    @staticmethod
    def _get_plugin_methods(plugin: BasePlugin) -> list[str]:
        """Какие API методы реализует плагин."""
        methods = []
        for method_name in ["search", "get_details", "download"]:
            method = getattr(type(plugin), method_name, None)
            if method is not None and method.__qualname__.startswith(
                type(plugin).__name__
            ):
                methods.append(method_name)
        return methods

    def unload_all(self) -> None:
        """Выгрузить все плагины."""
        self._plugins.clear()
        self._metadata.clear()
        logger.info("Все плагины выгружены")
