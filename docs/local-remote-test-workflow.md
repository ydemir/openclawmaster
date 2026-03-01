# Local + Remote Test Workflow

Bu akışla her değişiklikte push/deploy yapmadan localde test edersin.

## 1) Localde VPS verisi + gerçek gateway ile çalıştır

PowerShell:

```powershell
powershell -File scripts/openclaw-dev-remote.ps1
```

Ne yapar:
- VPS'ten `openclaw.json` ve ilgili dizinleri local `.remote-openclaw/config` içine sync eder.
- SSH tunnel açar: `127.0.0.1:18789 -> VPS gateway:18789`
- Local UI'ı `OPENCLAW_DIR=.remote-openclaw/config` ve `OPENCLAW_WS=ws://127.0.0.1:18789` ile başlatır.

Opsiyonlar:

```powershell
# Sadece tunnel + local run (sync yapmadan)
powershell -File scripts/openclaw-dev-remote.ps1 -NoSync

# Tunnel açmadan (sadece dosya sync + local run)
powershell -File scripts/openclaw-dev-remote.ps1 -NoTunnel

# Tüneli açık bırak
powershell -File scripts/openclaw-dev-remote.ps1 -KeepTunnel
```

## 2) Her şey tamam olunca push + publish

```powershell
powershell -File scripts/openclaw-release.ps1 -Message "fix: ilgili degisiklik"
```

Ne yapar:
- `apps/openclaw-ui` için `typecheck` + `lint`
- `git add -A` + `git commit -m ...` + `git push origin master`
- Coolify deploy tetikler ve sonucu bekler

Deploy tetiklemeden sadece push için:

```powershell
powershell -File scripts/openclaw-release.ps1 -Message "fix: ilgili degisiklik" -NoDeploy
```
