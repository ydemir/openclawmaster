---
name: notebooklm
description: Use this skill to save and query project memory in NotebookLM. Invoke when the user wants to log a decision, save a design doc, record a deployment, query project history, or any time important project context should be persisted across sessions. Also triggers automatically at session start, task completion, error resolution, and after repomix sync. This is the long-term memory layer of OpenClawMaster.
---

# NotebookLM Project Memory

## Overview

Bu skill OpenClawMaster'in uzun vadeli hafizasini yonetir.
MCP server (notebooklm-mcp) araclariyla calisir — ekstra kurulum gerekmez.
Notebook ID: `docs/notebooklm-notebook-id.txt` dosyasindan okunur.

---

## ZORUNLU AKIŞLAR — Sormadan Uygula

### 1. Session Başlangıcı
Kullanıcının ilk mesajından sonra, herhangi bir iş yapmadan önce:

```
notebook_query → "projenin mevcut durumu, son tamamlanan işler ve açık görevler neler?"
```

Sonucu kullanıcıya şu formatta özetle:
```
Geçen seferden:
- Son yapılan: {ne tamamlandı}
- Açık konular: {varsa}
- Dikkat edilecek: {varsa kritik not}
```

---

### 2. Görev / Prompt Akışı

**Görev başlamadan — Geçmişe Bak:**
```
notebook_query → "daha önce {konu} ile ilgili ne yapıldı veya ne kararlaştırıldı?"
```
Geçmişte çözüm varsa direkt uygula — tekrar araştırma.

**Görev tamamlandıktan sonra — Not Yaz:**
```
[TAMAMLANDI] {YYYY-MM-DD} — {görev adı}
Ne yapıldı: {madde madde}
Değişen dosyalar: {liste}
Sonuç: {çalışıyor mu, test edildi mi}
```

---

### 3. Hata Yönetimi Akışı

**Hata karşılaşıldığında — Önce Geçmişe Bak:**
```
notebook_query → "şu hata daha önce yaşandı mı: {hata mesajı veya özeti}"
```
- Geçmişte çözüm varsa → direkt uygula
- Yoksa → araştır, çöz, kaydet

**Hata çözüldükten sonra — SORMADAN Kaydet:**
```
[BUG-COZUM] {YYYY-MM-DD} — {hatanın kısa özeti}
Hata: {ne oluyordu, hata mesajı}
Kök neden: {neden oldu}
Çözüm: {nasıl düzeltildi, hangi dosya/satır}
Tekrar önleme: {önlem alındıysa belirt}
```

---

### 4. Repomix Sync Akışı

**Tetikleyiciler (3+ dosya değiştiğinde ZORUNLU):**
- Feature / skill tamamlandı
- Bug fix 3+ dosya değiştirdi
- Yeni skill eklendi

**Adımlar:**

**1. Paketle (PowerShell):**
```powershell
npx repomix@latest --style markdown --compress --ignore "docs/repomix-output.md,repomix-output.xml" --output docs/repomix-output.md
```

**2. Eski snapshot'ı sil:**
```
notebook_get → sources listesinden "Codebase Snapshot" başlıklı kaynağı bul
source_delete(source_id = {bulunan ID}, confirm = true)
```

**3. Yeni snapshot ekle:**
```
source_add(
  notebook_id = {notebooklm-notebook-id.txt'den oku},
  source_type = "file",
  file_path = "docs/repomix-output.md",
  title = "Codebase Snapshot — {YYYY-MM-DD}"
)
```

**4. Sync notu yaz:**
```
[REPOMIX-SYNC] {YYYY-MM-DD}
Dosya: {N} adet
Token: {repomix çıktısındaki token sayısı}
Neden: {tetikleyen olay}
```

---

### 5. Karar Kaydı

Tasarım kararı alındığında:
```
[KARAR] {YYYY-MM-DD} — {konu}
Ne: {karar ne}
Neden: {gerekçe}
Alternatifler: {değerlendirilen diğer seçenekler}
```

### 6. Deployment Kaydı

Deployment yapıldığında:
```
[DEPLOYMENT] {YYYY-MM-DD} — {uygulama adı}
Ortam: production / staging
Commit: {hash veya mesaj}
Durum: başarılı / başarısız
Not: {varsa özel durum}
```

---

## Notebook Yapısı

| Tip | İçerik |
|---|---|
| **Notes** | Kısa loglar: [TAMAMLANDI] [BUG-COZUM] [KARAR] [DEPLOYMENT] [REPOMIX-SYNC] |
| **Sources** | Codebase Snapshot (repomix), tasarım dokümanları (docs/plans/) |

**Kaynak önceliği:** Codebase Snapshot en güncel kaynak olmalı — eskisi silinmeli.

---

## MCP Araçları

| Tool | Ne Zaman |
|---|---|
| `notebook_query` | Session başı, görev öncesi, hata araştırma |
| `note` (create) | Görev sonu, hata çözümü, karar, deployment |
| `note` (list) | Mevcut notlara bak |
| `source_add` | Repomix sync, yeni doküman ekleme |
| `source_delete` | Eski snapshot silme |
| `notebook_get` | Source ID bulmak için |
| `notebook_create` | İlk kurulumda |
| `notebook_describe` | Notebook özeti |

---

## Notebook ID

Her zaman `docs/notebooklm-notebook-id.txt` dosyasından oku:
```
Mevcut ID: 01c4d534-e76e-4b5b-bd1c-723dd6b87d14
```

---

## Kurallar

- Kullanıcı "kaydet" demese de önemli olaylarda yaz
- Notlar madde madde, paragraf değil
- Her not başında etiket: [TAMAMLANDI] [BUG-COZUM] [KARAR] [DEPLOYMENT] [REPOMIX-SYNC]
- Hata araştırırken önce notebook'a sor — aynı hatayı tekrar araştırma
- Repomix sync'te eski snapshot silinmeden yeni eklenmez
- Türkçe sorulara Türkçe yanıt ver
