# OpenClawMaster - Codex Project Guide

## Goal
OpenClawMaster'i bir "agent swarm control plane" olarak gelistir ve islet:
- Windows 11 uzerinde lokal gelistirme yap
- Ubuntu VPS'i SSH uzerinden yonet
- Coolify uzerindeki deployment'lari yonet
- Proje hafizasini NotebookLM uzerinde kalici tut

## Operating model (2-tier)
- Orchestrator mindset: kapsam, kabul kriteri, oncelik, prompt kalitesi
- Executor mindset: kod yazimi, test, PR, deploy, dogrulama
- Once karar al, sonra uygula

## Definition of Done
Bir gorev/PR ancak su sartlarla "tamamlandi" sayilir:
1. Branch `main` ile guncel ve conflictsiz
2. CI yesil: lint + typecheck + tests
3. PR aciklamasi: ne degisti + nasil dogrulanir
4. UI degisti ise ekran goruntusu eklendi
5. NotebookLM'e `[TAMAMLANDI]` notu yazildi
6. 3+ dosya degisti ise Repomix sync yapildi

## Safety / Permissions
- Secret commit etme. `.env` dosyalari git disinda kalmali.
- Destructive islem oncesi acik onay al: `delete`, `stop`, `rm -rf`, DB degisiklikleri.
- Least-privilege token kullan.
- `--dangerously-skip-permissions` olsa bile onay disiplini bozma.
- Bu repoda `COOLIFY_BASE_URL` ve `COOLIFY_API_TOKEN` gibi degerleri dosyalara yazma.

## Repo conventions
- Branch naming: `feat/*`, `fix/*`, `chore/*`
- Kucuk PR tercih et. 300+ satirsa bol.
- PR oncesi daima lint + test calistir.
- Kod arama ve dosya kesfi icin once `rg` kullan.
- Git komutlarinda non-interactive akis kullan (`git add`, `git commit -m`, `git show`).

## Environment assumptions
- Ana gelistirme ortami: Windows 11, native PowerShell
- Lokal scriptler: `.ps1`; `.sh` scriptler yalnizca uzak Ubuntu VPS icin
- VPS SSH alias ile erisilebilir olmali
- `gh` CLI kurulu olmali
- Coolify yonetimi aktif olmali
- NotebookLM MCP/CLI akisi calisir olmali
- `repomix` kurulu olmali

## Codex + VS Code Working Notes
- Codex icin repo seviyesinde ana talimat dosyasi `AGENTS.md` kabul edilir.
- VS Code icinde de ayni kural setini uygula; farkli talimat dosyasi uretme.
- Arama: `rg --files`, `rg -n "<pattern>"` tercih et.
- Inceleme/review modunda once risk ve bug bulgularini listele, sonra ozet ver.
- Destructive komutlardan once kullanicidan acik dogrulama iste.
- Windows politikasi native PowerShell'dir.
- Bilgi notu: Codex agent mode bazi ortamlarda WSL ile daha uyumlu olabilir; bu repoda varsayilan native PowerShell kalir.
- `nlm chat start` kullanma. Interactive REPL yerine sorgu akisinda `notebook_query` kullan.

## Continuous Execution Rule (Zorunlu)
- Kullanici "proje hazir olana kadar durmadan calis" dediyse gorevi iteratif sekilde surdur:
  - Planla -> uygula -> test et -> duzelt -> tekrar test et dongusunu kesintisiz calistir.
  - Sadece su durumlarda dur ve kullaniciya soru sor:
    - Net bir urun/teknik karar gerekli ve repodan cikarilamiyor.
    - Harici erisim/credential/izin eksigi nedeniyle ilerlenemiyor.
    - Veri kaybi riski olan destructive islem icin acik onay gerekiyor.
- Yukaridaki blokeler disinda "ilerlemek mumkunse" durma.
- Tum MVP + DoD maddeleri tamamlanmadan "is bitti" deme.
- Is tamamen bittiginde tek bir net final rapor ver:
  - Tamamlananlar
  - Dogrulama/test sonucu
  - Varsa kalan riskler

## Skill usage map
- `brainstorming`: Yeni ozellik, davranis degisikligi, belirsiz kapsam
- `writing-plans`: Onayli tasarimi gorevlere ayirmadan once
- `openclaw-config`: OpenClaw kanal/session/cron/memory/RPC sorunlari
- `coolify-manager`: Coolify deployment, servis, env, API/CLI operasyonlari
- `notebooklm`: Proje hafizasi, karar kaydi, bug cozum kaydi, snapshot yonetimi
- Birden fazla skill gerekirse minimum set sec, sirayla uygula ve nedeni kisaca belirt.

## NotebookLM + Repomix Protocol (Zorunlu)
Bu protokol istisnasiz uygulanir. Notebook ID degerlerini sabit yazma; her zaman `docs/notebooklm-notebook-id.txt` dosyasindan oku.

## Session başlangıcı akışı
Kullanicinin ilk mesajindan hemen sonra:
1. `docs/notebooklm-notebook-id.txt` dosyasini oku (`ACTIVE`, `DEBUG`, `ARCHIVE`)
2. `ACTIVE` notebook uzerinden sorgula:
   - "projenin mevcut durumu, son tamamlanan isler ve acik gorevler neler?"
3. Sonucu su formatta ozetle:
   - Gecen seferden: son yapilanlar
   - Acik konular
   - Dikkat edilmesi gereken kritik notlar

## Görev öncesi/sonrası akış
Gorev baslamadan once:
- Benzer konu/hata/karar var mi diye NotebookLM'de ara.
- Varsa tekrar arastirma yapmadan mevcut cozumden ilerle.

Gorev tamamlaninca (kullanici istemese bile):
- `[TAMAMLANDI] YYYY-MM-DD - <gorev>` notu yaz.
- Kisa maddelerle su alanlari ekle:
  - Ne yapildi
  - Degisen dosyalar
  - Test/dogrulama sonucu
- 3+ dosya degisti ise Repomix sync tetikle.

## Hata yönetimi akışı
Hata goruldugunde:
1. Once `DEBUG` notebook'ta ara:
   - "bu hata daha once yasandi mi: <hata mesaji>"
2. Onceki cozum varsa dogrudan uygula.
3. Yoksa arastir, coz, dogrula.

Hata cozulunce:
- `DEBUG` notebook'a `[BUG-COZUM] YYYY-MM-DD - <ozet>` notu yaz.
- Su alanlari zorunlu ekle:
  - Hata
  - Kok neden
  - Cozum
  - Tekrar onleme adimi
- 3+ dosya degisti ise Repomix sync yap.

## Repomix sync tetikleyicileri ve adımları
Repomix sync zorunlu tetikleyiciler:
- 3 veya daha fazla dosya degisimi
- Yeni skill ekleme/guncelleme
- Feature/fix tamamlanmasi
- Session sonunda onemli degisiklik

Adimlar:
1. Paketle (PowerShell):
```powershell
npx repomix@latest --style markdown --compress --ignore "docs/repomix-output.md,repomix-output.xml" --output docs/repomix-output.md
```
2. NotebookLM'de eski "Codebase Snapshot" kaynagini sil (`source_delete`).
3. Yeni snapshot ekle (`source_add`, title: `Codebase Snapshot - YYYY-MM-DD`).
4. `[REPOMIX-SYNC]` notu yaz:
   - Dosya sayisi
   - Tetikleyen olay
   - Tarih

## Not formatı kuralları
- Notlar kisa ve madde madde olur; uzun paragraf yazma.
- Etiket zorunlu:
  - `[TAMAMLANDI]`
  - `[BUG-COZUM]`
  - `[KARAR]`
  - `[DEPLOYMENT]`
  - `[REPOMIX-SYNC]`
- Tarih formati: `YYYY-MM-DD`
- Kullanici "kaydet" demese de onemli olaylari yaz.
- Karar notunda alternatifleri ve gerekceyi ekle.
- Deployment notunda ortam, commit ve sonuc durumunu ekle.

## Quick command snippets
Dosya arama:
```powershell
rg --files
rg -n "NotebookLM|Repomix|openclaw" -S
```

Git (non-interactive):
```powershell
git add -A
git commit -m "chore: update AGENTS.md guidance"
git show --stat --oneline -1
```

Repomix:
```powershell
npx repomix@latest --style markdown --compress --ignore "docs/repomix-output.md,repomix-output.xml" --output docs/repomix-output.md
```

NotebookLM akisi (ozet):
```text
1) notebook id dosyasini oku: docs/notebooklm-notebook-id.txt
2) notebook_query ile gecmisi sorgula
3) gorev sonu note(create) ile [TAMAMLANDI] kaydi yaz
4) gerekirse source_add/source_delete ile snapshot guncelle
```
