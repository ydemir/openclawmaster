# Coolify API — CLI'de Olmayan Endpoint'ler

Bu endpoint'ler `scripts/api_call.ps1` ile kullanilir.

**Kullanim:**
```powershell
powershell -File scripts/api_call.ps1 -Method <METHOD> -Endpoint "<ENDPOINT>"
powershell -File scripts/api_call.ps1 -Method POST -Endpoint "<ENDPOINT>" -Body '<JSON>'
```

Base URL: `.env` dosyasindaki `COOLIFY_BASE_URL`
Auth: `.env` dosyasindaki `COOLIFY_API_TOKEN` (Bearer token)

---

## Webhooks

### Listele
```powershell
powershell -File scripts/api_call.ps1 -Method GET -Endpoint "/webhooks"
```

### Olustur
```powershell
powershell -File scripts/api_call.ps1 -Method POST -Endpoint "/webhooks" -Body '{"url":"https://example.com/hook","events":["deploy","start","stop"]}'
```

### Sil
```powershell
powershell -File scripts/api_call.ps1 -Method DELETE -Endpoint "/webhooks/{uuid}"
```

---

## PR Preview Environments

### Uygulama PR preview'larini listele
```powershell
powershell -File scripts/api_call.ps1 -Method GET -Endpoint "/applications/{uuid}/preview"
```

---

## Sentinel Metrics (Sunucu Kaynak Izleme)

### Sunucu metriklerini al
```powershell
powershell -File scripts/api_call.ps1 -Method GET -Endpoint "/servers/{uuid}/metrics"
```

Dondurur: CPU, RAM, disk kullanimi ve diger sunucu metrikleri.

---

## Proxy Yonetimi (Traefik / Caddy)

### Proxy'yi yeniden baslat
```powershell
powershell -File scripts/api_call.ps1 -Method POST -Endpoint "/servers/{uuid}/proxy/restart"
```

---

## Audit Logs (Aktivite Gecmisi)

### Tum aktiviteleri listele
```powershell
powershell -File scripts/api_call.ps1 -Method GET -Endpoint "/activities"
```

---

## Custom Domains

### Listele
```powershell
powershell -File scripts/api_call.ps1 -Method GET -Endpoint "/domains"
```

### Ekle
```powershell
powershell -File scripts/api_call.ps1 -Method POST -Endpoint "/domains" -Body '{"domain":"example.com","resource_uuid":"APP_UUID"}'
```

---

## API Token Yonetimi

### Mevcut token'lari listele
```powershell
powershell -File scripts/api_call.ps1 -Method GET -Endpoint "/security/tokens"
```

---

## Instance Ayarlari

### Ayarlari oku
```powershell
powershell -File scripts/api_call.ps1 -Method GET -Endpoint "/settings"
```

### Ayarlari guncelle
```powershell
powershell -File scripts/api_call.ps1 -Method PATCH -Endpoint "/settings" -Body '{"fqdn":"https://coolify.tulli.cloud"}'
```

---

## Notlar

- `{uuid}` yerine ilgili kaynaginn UUID'sini yaz (`coolify resource list` ile bulabilirsin)
- DELETE isteklerinde `-Body` parametresi kullanma
- JSON body tek tirnak icinde yaz (PowerShell'de cift tirnak kacinmasi gerekir)
- Hata durumunda HTTP status kodu ve mesaj goruntulenir
