# Quiniela PetroBoscan — Puesta en marcha

Estos archivos van DENTRO de `pdvsa/QuinielaPetroBoscan/`
(al lado de tus carpetas Despacho y SCADA, sin mezclarse con ellas).

## 1. Instalar dependencias
```bash
cd pdvsa/QuinielaPetroBoscan
npm install
```

## 2. Conectar con Supabase
- Crea el proyecto en https://supabase.com
- En el SQL Editor, pega y ejecuta `quiniela_petroboscan_fase0.sql`
- Copia `.env.example` a `.env` y rellena:
  - VITE_SUPABASE_URL  -> Project Settings > API > Project URL
  - VITE_SUPABASE_ANON_KEY -> Project Settings > API > anon public

## 3. Correr en local
```bash
npm run dev
```
Para probar desde el celular en la misma red Wi-Fi, abre la URL "Network"
que muestra la terminal.

Si la pantalla dice "Conectado · 0 equipos cargados", la conexión funciona;
los equipos aparecen cuando corramos el script de siembra (siguiente paso).
