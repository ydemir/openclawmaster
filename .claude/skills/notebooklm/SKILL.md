---
name: notebooklm
description: Use this skill to save and query project memory in NotebookLM. Invoke when the user wants to log a decision, save a design doc, record a deployment, query project history, or any time important project context should be persisted across sessions. This is the long-term memory layer of OpenClawMaster.
---

# NotebookLM Project Memory

## Overview

Bu skill, OpenClawMaster projesinin uzun vadeli hafizasini NotebookLM uzerinde yonetir.
MCP server (notebooklm-mcp) araclariyla calisir — ekstra kurulum gerekmez.

**Ana Notebook:** Proje icin tek bir merkezi notebook kullanilir.
Notebook ID'si ilk kullanimda olusturulur ve `docs/notebooklm-notebook-id.txt` dosyasina kaydedilir.

---

## Ne Zaman Kullanilir

- Yeni bir tasarim karari alindiktan sonra → kaydet
- Bir skill tamamlandi → kaydet
- Deployment yapildi → kaydet
- Bir bug cozuldu → kaydet
- Gecmis bir kararı hatirlamak gerektiginde → sorgula
- Yeni bir session baslarken bağlam kurmak icin → sorgula

---

## Workflow

### 1. Notebook Bul veya Olustur

```
1. docs/notebooklm-notebook-id.txt dosyasini oku
2. Dosya varsa → ID'yi kullan
3. Dosya yoksa → notebook_list ile "OpenClawMaster" ara
4. Hala yoksa → notebook_create ile olustur, ID'yi kaydet
```

### 2. Kayit Yap (Log)

Asagidaki kategorilerde not olarak kaydet:

**Tasarim Karari:**
```
[KARAR] {tarih} — {konu}
Ne: {ne kararlasildi}
Neden: {gerekcesi}
Alternatifler: {diger secenekler}
```

**Tamamlanan Is:**
```
[TAMAMLANDI] {tarih} — {skill/task adi}
Ne yapildi: {ozet}
Dosyalar: {degistirilen dosyalar}
Sonuc: {kabul kriterleri gercti mi}
```

**Deployment:**
```
[DEPLOYMENT] {tarih} — {uygulama adi}
Ortam: {production/staging}
Versiyon/Commit: {bilgi}
Durum: {basarili/basarisiz}
Not: {varsa ozel durum}
```

**Bug / Cozum:**
```
[BUG-COZUM] {tarih} — {bug ozeti}
Hata: {ne oluyordu}
Kök neden: {neden oluyordu}
Cozum: {nasil cozuldu}
```

### 3. Sorgulama

Kullanici proje gecmisini sorguladiginda `notebook_query` kullan.

Ornek sorgular:
- "coolify-manager skill ne zaman yapildi?"
- "brainstorming oturumlarinda alinan kararlar neler?"
- "son deployment ne zamandy?"
- "hangi bug'lar cozuldu?"

---

## Repomix Sync — Codebase'i Notebook'a Ekle

Repomix, tüm codebase'i tek bir AI-dostu dosyaya paketler. Bu dosya NotebookLM'e kaynak olarak eklenerek AI'ın her zaman güncel kod bağlamına sahip olması sağlanır.

### Ne Zaman Yapılır
- 3+ dosya değiştiğinde (otomatik kural)
- Yeni skill eklendiğinde
- Büyük bir feature tamamlandığında
- Notebook'taki snapshot 1 günden eskiyse

### Adımlar

**1. Codebase'i paketle (PowerShell):**
```powershell
npx repomix@latest --style markdown --compress --output docs/repomix-output.md
```

**2. Eski snapshot kaynağını sil (varsa):**
```
source_list_drive ile "Codebase Snapshot" adlı kaynağı bul → source_delete ile sil
```

**3. Yeni snapshot'ı kaynak olarak ekle:**
```
source_add(
  notebook_id = <docs/notebooklm-notebook-id.txt'den oku>,
  source_type = "file",
  file_path = "docs/repomix-output.md",
  title = "Codebase Snapshot — {YYYY-MM-DD}"
)
```

**4. Sync notunu kaydet:**
```
[REPOMIX-SYNC] {tarih} — Codebase snapshot güncellendi
Dosya sayısı: {N}
Token: {repomix çıktısındaki token sayısı}
```

### Repomix Seçenekleri

| Seçenek | Açıklama |
|---|---|
| `--compress` | Tree-sitter ile kod sıkıştırma — token tasarrufu |
| `--style markdown` | Markdown çıktı (NotebookLM için ideal) |
| `--include-logs` | Git commit geçmişini dahil et |
| `--ignore "docs/repomix-output.md"` | Kendi çıktısını dışarıda bırak |
| `--output docs/repomix-output.md` | Çıktı konumu |

### .gitignore Notu
`docs/repomix-output.md` git'e commit edilmez — sadece NotebookLM için üretilir.

---

## MCP Araclari

Bu skill asagidaki MCP toollarini kullanir:

| Tool | Kullanim |
|---|---|
| `notebook_list` | Mevcut notebooklari listele |
| `notebook_create` | Yeni notebook olustur |
| `notebook_query` | Proje hafizasini sorgula |
| `note` (action=create) | Yeni not ekle |
| `note` (action=list) | Mevcut notlari listele |
| `source_add` | Dokuman/URL kaynak olarak ekle |
| `notebook_describe` | Notebook ozetini al |

---

## Notebook Yapisi

Tek notebook, iki icerik tipi:

**Notes** — Kisa, yapisal loglar (kararlar, deploymentlar, bug cozumleri)

**Sources** — Uzun dokumanlari (tasarim dokumanlari, implementation planlari `docs/plans/` altindakiler)

---

## Baslangic Kurulumu (ilk kullanimda)

1. `notebook_list` ile "OpenClawMaster" adli notebook ara
2. Yoksa `notebook_create` ile olustur: title = "OpenClawMaster — Project Memory"
3. Notebook ID'sini `docs/notebooklm-notebook-id.txt` dosyasina yaz
4. Ilk source olarak `docs/plans/` altindaki tasarim dokümanlarini ekle

---

## Onemli Kurallar

- Her onemli karar veya tamamlanan is sonrasi kayit yap — sorulmasan da
- Kayitlari kisa ve yapisal tut (uzun paragraflar degil, madde madde)
- Notebook ID'yi her zaman `docs/notebooklm-notebook-id.txt` dosyasindan oku
- Sorgularken Turkce soru geldiyse Turkce yanit ver
