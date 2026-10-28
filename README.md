# Biblioteca Católica

PWA pública en español del catálogo de la biblioteca personal de Carlos Buela. Sin dependencias ni proceso de compilación. Los libros se abren mediante sus enlaces externos; los registros sin enlace muestran «no disponible».

## Publicación en GitHub Pages

1. Crear un repositorio público en GitHub y subir **el contenido de esta carpeta**, incluida `.github`, a la raíz de la rama `main`.
2. En **Settings → Pages → Build and deployment → Source**, seleccionar **GitHub Actions**.
3. Abrir **Actions → Actualizar catálogo y publicar PWA → Run workflow**. Al terminar, el entorno `github-pages` mostrará la dirección pública.

La actualización está programada diariamente a las **00:00 UTC (08:00 en Hong Kong)**. GitHub puede retrasar las ejecuciones programadas y desactivarlas en repositorios públicos tras 60 días sin actividad; revisa Actions si dejan de ejecutarse. También se actualiza al publicar cambios en `main` y mediante ejecución manual. La automatización solo comienza una vez publicado el repositorio.

La hoja debe seguir siendo legible públicamente por enlace. Los archivos de Drive mantienen sus propios permisos: un enlace presente no garantiza que el archivo sea accesible para todos. El importador solo lee B, D, E, K, L, M, N y V; el archivo original no se modifica. No se importan ni publican las demás columnas.

La automatización conserva una copia del último catálogo correcto mediante la caché de Actions. Si esa caché no está disponible y Google Sheets falla, se usa el catálogo incluido en el repositorio. Las importaciones fallidas o vacías no sobrescriben archivos. Si cambia la estructura de columnas, la importación se detiene y aparece una advertencia en Actions.

## Vista previa local

Con Python 3, ejecutar desde esta carpeta:

```sh
python3 -m http.server 8080
```

Abrir `http://localhost:8080`. Los service workers necesitan HTTPS o localhost. La PWA se instala desde el navegador compatible (en iPhone: Compartir → Añadir a pantalla de inicio). La instalación no aparece en todos los navegadores; el catálogo también funciona como web.

## Actualizar datos manualmente

```sh
python3 scripts/update_catalog.py
```

El catálogo se consulta sin conexión después de una primera visita que haya completado su almacenamiento. Los archivos de Drive requieren conexión. Para cambios futuros en los archivos de la app, incrementar `CACHE` en `sw.js` para activar el aviso de nueva versión.
