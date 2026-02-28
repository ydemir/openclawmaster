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
