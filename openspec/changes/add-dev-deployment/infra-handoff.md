# feima-infra handoff

Changes needed in `feimacode/feima-infra` (private). Not made by this proposal; sketched from reading the current role, playbook and inventory. No secret values appear here.

## What exists today

- One VM, listed twice in `ansible/inventory/hosts.yml` (`global_dev` and `global_prod`, same `ansible_host`). The group decides `deploy_environment`, `compose_project_name`, network and deploy path. `global_dev` only hosts easystudy; its vault is `inventory/group_vars/global_dev/vault.yml`.
- `playbooks/deploy-askrighto.yml` has `hosts: global_prod`. The `askrighto` role defaults to `askrighto_version: latest`, port 8320, 0.5 CPU, 768 MB, network `askrighto_{{ deploy_environment }}_network`, Traefik file `/opt/traefik/dynamic/{{ compose_project_name }}-askrighto.yml`, container `{{ compose_project_name }}-askrighto`. Most paths already key on `compose_project_name`, so the dev container becomes `dev-askrighto` with no template change.
- Course settings render only when `vault_askrighto_internal_token` exists (`env.j2`, `load-data.yml` conditions).

## Changes

1. **`global_dev/main.yml`**: add the `askrighto_*` block.
   - `askrighto_domain: askrighto-dev.feimacode.com`, `askrighto_port: 8321`, `askrighto_deploy_path: /opt/feima/dev/askrighto`, `askrighto_network: askrighto_dev_network`
   - `askrighto_version: latest`, `askrighto_channel: dev`
   - `askrighto_verticals: "energy,courses-domestic,cricos,home-loans"`
   - `askrighto_database_url: "{{ vault_askrighto_dev_database_url }}"`, `askrighto_db_pool_max: 3`
   - `askrighto_access_token: "{{ vault_askrighto_dev_access_token }}"`, `askrighto_profile_key: "{{ vault_askrighto_dev_profile_key }}"`
   - `askrighto_sync_per_retailer_rps: 1`, `askrighto_sync_at: "04:00"`, `askrighto_load_data_on_deploy: true`
2. **`global_dev/vault.yml.example`**: add the three `vault_askrighto_dev_*` names with placeholders. Production's vault is not touched.
3. **`deploy-askrighto.yml`**: `hosts: "{{ askrighto_target | default('global_prod') }}"` (or two plays), so `ansible-playbook playbooks/deploy-askrighto.yml -e askrighto_target=global_dev -l global-au-dev` works. Traefik and Docker are installed once via the production group, as for easystudy; confirm Traefik is reachable from the dev network (the role already connects the `traefik` container to the app network).
4. **Role defaults** (`roles/askrighto/defaults/main.yml`): `askrighto_version: stable`; replace `askrighto_course_verticals` / `askrighto_public_verticals` / `askrighto_internal_token` with `askrighto_verticals: "energy"`, `askrighto_channel: stable`, `askrighto_access_token: ""`, `askrighto_profile_key: ""`, and add `askrighto_sync_at: "02:30"`.
5. **`templates/env.j2`**: always render `ASKRIGHTO_VERTICALS`, `ASKRIGHTO_CHANNEL`, `ASKRIGHTO_SYNC_AT`; render `ASKRIGHTO_ACCESS_TOKEN` and `ASKRIGHTO_PROFILE_KEY` when set. Drop the `ASKRIGHTO_PUBLIC_VERTICALS` and `ASKRIGHTO_INTERNAL_TOKEN` lines **only after** the server cleanup release (task 3) is deployed, because the current image needs them until then.
6. **`tasks/main.yml`**: change the `load-data.yml` condition from "internal token set" to `askrighto_load_data_on_deploy | bool` (default false in the role, true on dev). Production never loads course data.
7. **`global_prod/main.yml`**: `askrighto_version: "<current release>"` (a quoted number, updated by whoever deploys), and remove `askrighto_internal_token` after cutover.
8. **Optional auto-deploy** (`roles/askrighto/tasks/autodeploy.yml`, templates for a script, a systemd service and a timer; included only when `askrighto_autodeploy | bool`, true on dev only). The script: `docker pull ghcr.io/feimacode/askrighto:latest`, compare the image id with the running container's, and if it changed run the migrate one-shot, `docker compose up -d --force-recreate`, then poll `http://localhost:8321/healthz`; log to the journal; exit non-zero (leaving the old container) if migrate fails.
9. **README** of the role: replace "Internal course verticals" with "Dev deployment" and "Pinned production".

## Manual steps on the VM (admin)

- Create database `askrighto_dev` and role `askrighto_dev` on the flexible server (from the VM; the server is private to the VNet). The role needs create rights on its own database only.
- Cloudflare DNS record for the dev host, same as `askrighto.feimacode.com`.
- First loads after the first dev deploy: `docker exec dev-askrighto node askrighto.js sync-energy` (a single retailer first: `--retailer agl`), then `load-all` runs on deploy.

## Cost and capacity

No new VM and no new managed service. Dev adds one container capped at 0.5 CPU and 768 MB, a database on the existing Azure PostgreSQL server (courses are the largest dataset, a few hundred MB), and a Cloudflare record. Verify headroom with `docker stats` and free memory before the first deploy; if tight, lower dev's limit before resizing the VM.

## Verification

`ansible-playbook ... --check` for both targets; after the first dev deploy, `/healthz` shows `"channel"` (once the server release has it), `/readyz` is 200 after the loads, and `npm run release:smoke -- https://askrighto-dev.feimacode.com <version> --channel dev --token <token>` passes. Production smoke must still list energy tools only.
