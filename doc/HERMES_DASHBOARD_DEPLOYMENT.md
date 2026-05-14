# Hermes dashboard: red y exposición en despliegue

Fecha de verificación: 2026-05-14.

## Resultado ejecutivo

- En este repositorio **no existe** un `docker-compose`, manifiesto Kubernetes o ingress específico para publicar el dashboard web de Hermes como servicio público separado.
- La integración de Paperclip con Hermes en V1 se basa en:
  - ejecución local del binario `hermes` dentro del runtime de Paperclip,
  - endpoint de eventos firmado (`POST /api/hermes/events`) para sincronización,
  - reconciliación periódica de drift de configuración en heartbeat.
- Por diseño operativo, el dashboard de Hermes debe mantenerse en `127.0.0.1` o red interna privada; no se requiere exposición pública para que Paperclip sincronice configuración.

## 1) Revisión de artefactos de despliegue

Se revisaron:

- `docker/docker-compose.yml`
- `docker/docker-compose.quickstart.yml`
- `docker/quadlet/paperclip.container`
- `docker/ecs-task-definition.json`
- `scripts/docker-entrypoint.sh`

Hallazgos:

1. Los artefactos de despliegue versionados exponen **Paperclip** (`3100`) y DB según entorno, pero no definen servicio `hermes-dashboard` ni mapeo de puerto Hermes dedicado.
2. `scripts/docker-entrypoint.sh` prepara `HERMES_HOME` y estado local para ejecución CLI de Hermes dentro del contenedor de Paperclip, sin publicación explícita de UI/dashboard Hermes.

## 2) Validación del bind de puerto del dashboard Hermes

- No hay configuración en repo que publique un puerto HTTP de Hermes dashboard hacia `0.0.0.0`.
- Requisito operativo recomendado para entorno real:
  - si el dashboard Hermes se habilita, bind estricto a `127.0.0.1` o red privada interna no enrutable,
  - nunca exponerlo directo a internet en `0.0.0.0` sin capa de control.

## 3) Reglas de ingress / reverse-proxy

- En los manifiestos versionados no hay ruta pública dedicada al dashboard Hermes.
- Política recomendada para despliegue real:
  1. no crear ruta pública al dashboard Hermes por defecto,
  2. si excepcionalmente se publica, exigir autenticación fuerte explícita (SSO + MFA + allowlist de red),
  3. registrar y auditar acceso.

## 4) Confirmación de dependencias Paperclip ↔ Hermes

Paperclip no necesita dashboard Hermes público para sincronizar:

- `POST /api/hermes/events` recibe eventos firmados de Hermes para invalidación/sync de config.
- Validación HMAC y mapeo company/agent antes de aceptar eventos.
- Reconciliación periódica de drift en heartbeat para consistencia aun sin acceso al dashboard.

Esto permite mantener el dashboard Hermes como superficie de configuración operativa (privada) y usar sólo APIs/eventos necesarios para Paperclip.

## 5) Arquitectura final documentada

**Hermes Dashboard para config del agente; Paperclip consume cambios en tiempo real.**

Flujo final:

1. Operador ajusta configuración de agente en Hermes Dashboard (acceso privado).
2. Hermes emite evento firmado a `Paperclip /api/hermes/events`.
3. Paperclip valida firma + mapeo compañía/agente, invalida caché y actualiza versión de config.
4. Heartbeat consume configuración vigente y además ejecuta drift reconciliation periódica.

## Checklist de hardening para producción

- [ ] Dashboard Hermes solo en loopback (`127.0.0.1`) o subnet interna privada.
- [ ] Sin ruta pública en ingress/reverse-proxy por defecto.
- [ ] Si hay exposición excepcional: SSO/MFA, IP allowlist, TLS estricto, logging/auditoría.
- [ ] Secret de firma webhook Hermes rotado y almacenado en secret manager.
- [ ] Monitoreo de `401`/`409` en `/api/hermes/events` y alertas.
