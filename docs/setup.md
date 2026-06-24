# Setup / Dependencies

## Python

```bash
venv/bin/pip install vulture
```

Устанавливается в venv, проверяется `test.py --check deps`.

## Node.js

```bash
npm install
```

Ставит `jscpd` (duplicate code detection). `npx jscpd` — CLI. `package.json` и `node_modules/` в корне, `.gitignore` уже исключает `node_modules/`.

## Запуск

```bash
venv/bin/python test.py              # все проверки
venv/bin/python test.py --check deps # только зависимости
```
