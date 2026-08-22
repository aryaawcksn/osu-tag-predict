# Implementation Plan

- [ ] 1. Setup database dan backend foundation






  - [ ] 1.1 Tambah dependencies ke backend




    - Tambah asyncpg, sqlalchemy[asyncio], python-jose[cryptography], httpx, hypothesis, pytest-asyncio ke `backend/requirements.txt`
    - _Requirements: 5.1_
  - [x] 1.2 Buat schema PostgreSQL dan database connection utilities










    - Buat `backend/database.py` dengan async SQLAlchemy engine dan session factory
    - Buat `backend/models.py` dengan ORM models: User, Session, QueueItem, Beatmap, BeatmapLabel
    - Buat `backend/migrations/init.sql` dengan CREATE TABLE statements sesuai design
    - _Requirements: 5.1, 5.2_
  - [ ]* 1.3 Write property test untuk beatmap upsert idempotency
    - **Property 10: Beatmap upsert idempotency**
    - **Validates: Requirements 5.3**


- [x] 2. Implementasi QueueManager





  - [x] 2.1 Buat `backend/queue_manager.py`






    - asyncio semaphore maks 5 slot
    - Method: enqueue, mark_complete, mark_failed, get_queue_state
    - Persist setiap perubahan ke tabel queue_items
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 2.2 Implementasi restore_from_db untuk queue persistence

    - Saat startup, reload queue_items dengan status waiting/processing dari DB
    - _Requirements: 5.5_
  - [ ]* 2.3 Write property test untuk queue capacity invariant
    - **Property 1: Queue capacity invariant**
    - **Validates: Requirements 1.2, 1.3, 1.4**
  - [ ]* 2.4 Write property test untuk queue slot release invariant
    - **Property 2: Queue slot release invariant**
    - **Validates: Requirements 1.4**
  - [ ]* 2.5 Write property test untuk queue persistence round-trip
    - **Property 11: Queue persistence round-trip**
    - **Validates: Requirements 5.5**


- [x] 3. Integrasi queue ke endpoint prediksi





  - [x] 3.1 Refactor POST /predict/link dan POST /predict/upload untuk melalui QueueManager





    - Endpoint return job_id dan position, bukan langsung result
    - Jalankan prediksi sebagai background task di asyncio
    - _Requirements: 1.2, 1.3, 6.1_
  - [x] 3.2 Tambah endpoint GET /queue/state dan GET /queue/job/{id}





    - /queue/state return slot terpakai, kapasitas, list jobs aktif
    - /queue/job/{id} return status dan result job
    - _Requirements: 1.1, 1.6_

  - [x] 3.3 Auto-store prediction result ke tabel beatmaps setelah prediksi berhasil




    - Panggil upsert_beatmap setelah setiap prediksi sukses di background task
    - _Requirements: 4.5, 5.2_
  - [ ]* 3.4 Write property test untuk beatmap record round-trip
    - **Property 9: Beatmap record round-trip**
    - **Validates: Requirements 4.4, 4.5, 5.2**
  - [ ]* 3.5 Write property test untuk unauthenticated prediction tidak linked ke user
    - **Property 12: Unauthenticated prediction not linked to user**
    - **Validates: Requirements 6.2**


- [x] 4. Checkpoint




  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implementasi osu! OAuth





  - [x] 5.1 Buat `backend/auth.py` dengan OAuth flow handler


    - GET /auth/login redirect ke osu! OAuth URL
    - GET /auth/callback exchange code, fetch /me, simpan session ke DB, set cookie httpOnly
    - POST /auth/logout hapus session dari DB, clear cookie
    - GET /auth/me return user info dari session aktif
    - _Requirements: 2.1, 2.2, 2.3, 2.5_


  - [x] 5.2 Buat session middleware dan dependency get_current_user

    - FastAPI dependency yang baca cookie session_id dan validasi session dari DB
    - Return None (bukan error) untuk guest; raise 401 hanya pada endpoint yang wajib auth

    - _Requirements: 2.4_
  - [x] 5.3 Implementasi token refresh logic

    - Sebelum osu! API call, cek expires_at; jika expired, refresh otomatis dan update DB
    - _Requirements: 2.6_
  - [x] 5.4 Wire auth router ke main.py dan update lifespan untuk init DB connection


    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_
  - [ ]* 5.5 Write property test untuk OAuth session lifecycle
    - **Property 4: OAuth session lifecycle**
    - **Validates: Requirements 2.2, 2.5**

- [x] 6. Frontend: NavBar, QueueBar, dan auth flow





  - [x] 6.1 Tambah tipe QueueState, QueueJob, CurrentUser, DominantPlaystyle ke `frontend/src/types.ts`


    - _Requirements: 1.1, 1.6, 2.4_
  - [x] 6.2 Update `frontend/src/api.ts` untuk queue-aware endpoints


    - predictFromLink dan predictFromUpload return `{job_id, position}`
    - Tambah getQueueState(), getJobResult(job_id), getCurrentUser(), logout()
    - Tambah pollJobResult(job_id) yang poll GET /queue/job/{id} sampai done/failed
    - _Requirements: 1.2, 1.6, 2.4_
  - [x] 6.3 Buat `frontend/src/components/NavBar.tsx`


    - Tampilkan username jika authenticated, tombol Login (href /auth/login) jika guest
    - Tombol Logout call POST /auth/logout lalu reload
    - _Requirements: 2.4, 6.3_
  - [x] 6.4 Buat `frontend/src/components/QueueBar.tsx`


    - Poll GET /queue/state setiap 2 detik menggunakan useEffect + setInterval
    - Tampilkan slot terpakai/kapasitas dan list job aktif dengan status badge
    - _Requirements: 1.1, 1.5, 1.6_
  - [x] 6.5 Update App.tsx untuk integrasi NavBar, QueueBar, dan queue-aware submission


    - Handle loading state saat polling job result setelah submit
    - Disable submit button saat queue penuh (occupied_slots >= total_capacity)
    - Tampilkan AnalysisPanel dan RecommendationList hanya jika authenticated
    - Tampilkan prompt login untuk guest yang mencoba fitur analisis
    - _Requirements: 1.3, 2.4, 6.3_
  - [ ]* 6.6 Write property test untuk queue job status display
    - **Property 3: Queue job status display completeness**
    - **Validates: Requirements 1.6**
  - [ ]* 6.7 Write property test untuk authenticated username display
    - **Property 5: Authenticated username display**
    - **Validates: Requirements 2.4**

- [x] 7. Implementasi AnalysisService





  - [x] 7.1 Buat `backend/analysis.py`


    - fetch_top_plays(user_id, token, limit=20) dan fetch_recent_plays menggunakan httpx ke osu! API
    - calculate_dominant_playstyle(predictions): rata-rata probabilitas per label, return label tertinggi
    - _Requirements: 3.1, 3.2, 3.4_
  - [x] 7.2 Buat endpoint GET /analysis/playstyle?source=top|recent di main.py


    - Wajib authenticated (gunakan get_current_user dependency)
    - Fetch play history, submit setiap beatmap ke queue secara batch (batched agar tidak overflow 5 slot)
    - Tunggu semua selesai, skip yang failed, return DominantPlaystyle
    - _Requirements: 3.1, 3.2, 3.3, 3.6_
  - [ ]* 7.3 Write property test untuk dominant playstyle calculation
    - **Property 7: Dominant playstyle calculation correctness**
    - **Validates: Requirements 3.4**
  - [ ]* 7.4 Write property test untuk play history queue submission
    - **Property 6: Play history queue submission completeness**
    - **Validates: Requirements 3.3, 3.6**

- [x] 8. Implementasi RecommendationService





  - [x] 8.1 Buat `backend/recommendation.py`

    - get_recommendations(playstyle, limit=10): query beatmap_labels untuk primary match; jika < 5 hasil, tambah secondary matches
    - upsert_beatmap(result): insert atau update beatmaps + beatmap_labels (ON CONFLICT DO UPDATE)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 8.2 Tambah endpoint GET /recommend dan POST /admin/beatmap di main.py


    - GET /recommend memerlukan authenticated session, query get_recommendations dengan dominant playstyle dari sesi analisis terakhir atau query param
    - POST /admin/beatmap memerlukan header X-Admin-Key yang cocok dengan env var ADMIN_KEY
    - _Requirements: 4.1, 4.6, 5.4_
  - [ ]* 8.3 Write property test untuk recommendation label filter
    - **Property 8: Recommendation label filter correctness**
    - **Validates: Requirements 4.1**
  - [ ]* 8.4 Write property test untuk recommendation fallback
    - **Property (4.3): Recommendation fallback to secondary labels**
    - **Validates: Requirements 4.3**

- [x] 9. Frontend: AnalysisPanel dan RecommendationList





  - [x] 9.1 Buat `frontend/src/components/AnalysisPanel.tsx`


    - Dropdown pilih sumber (Top Plays / Recent Plays)
    - Tombol Analyze call GET /analysis/playstyle?source=...
    - Progress indicator: diproses / total menggunakan polling selama analisis berjalan
    - Tampilkan dominant playstyle label dan average probability setelah selesai
    - _Requirements: 3.1, 3.5_
  - [x] 9.2 Buat `frontend/src/components/RecommendationList.tsx`


    - Terima dominant playstyle sebagai prop, call GET /recommend?playstyle=...
    - Render card per beatmap: beatmap_id, BPM, AR, CS, OD, object count, playstyle tags
    - Tampilkan empty state jika tidak ada rekomendasi (Requirements 4.6)
    - _Requirements: 4.2, 4.6_

- [x] 10. Final Checkpoint





  - Ensure all tests pass, ask the user if questions arise.
