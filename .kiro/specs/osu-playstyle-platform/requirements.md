# Requirements Document

## Introduction

Platform web untuk prediksi playstyle beatmap osu! yang dilengkapi sistem antrian live, autentikasi via osu! OAuth, dan sistem rekomendasi map berdasarkan analisis playstyle dari riwayat bermain user. Backend berjalan di Ubuntu server dengan Cloudflare Tunnel, frontend di Vercel, dan database PostgreSQL di server yang sama.

## Glossary

- **Playstyle**: Karakteristik cara bermain yang diprediksi dari fitur beatmap (contoh: aim, speed, tech, stream)
- **Queue**: Antrian pemrosesan prediksi dengan kapasitas maksimum 5 slot bersamaan
- **Queue Slot**: Satu posisi dalam antrian yang ditempati oleh satu request prediksi
- **osu! OAuth**: Sistem autentikasi resmi osu! menggunakan OAuth 2.0
- **Access Token**: Token sementara yang diperoleh setelah osu! OAuth berhasil untuk mengakses osu! API
- **Top Plays**: Daftar beatmap dengan skor tertinggi yang pernah dimainkan user di osu!
- **Recent Plays**: Daftar beatmap yang baru-baru ini dimainkan user di osu!
- **Dominant Playstyle**: Playstyle dengan rata-rata probabilitas tertinggi dari kumpulan prediksi
- **Beatmap Database**: Database internal yang berisi beatmap beserta label playstyle hasil prediksi
- **Prediction Result**: Hasil prediksi playstyle dari sebuah beatmap berisi label dan probabilitas
- **Session**: Data login user yang disimpan sementara di server
- **User**: Pemain osu! yang telah melakukan autentikasi
- **Guest**: Pengunjung web yang belum melakukan autentikasi
- **Backend**: Server FastAPI yang berjalan di Ubuntu dengan Cloudflare Tunnel
- **Frontend**: Aplikasi React yang di-deploy di Vercel

---

## Requirements

### Requirement 1: Sistem Antrian Live

**User Story:** As a guest or user, I want to see a live queue of prediction requests, so that I know how many slots are available and can track my request's progress.

#### Acceptance Criteria

1. WHEN the web page loads, THE system SHALL display the current queue state showing the number of occupied slots and total capacity (maximum 5 slots).
2. WHEN a prediction request is submitted, THE system SHALL add the request to the queue and assign it a position number.
3. WHILE the queue is at maximum capacity (5 slots), THE system SHALL reject new prediction requests and display a message indicating the queue is full.
4. WHEN a prediction request completes or fails, THE system SHALL remove it from the queue and free the slot for the next request.
5. WHEN the queue state changes, THE system SHALL update the displayed queue within 3 seconds on all active browser sessions.
6. WHILE a user has an active request in the queue, THE system SHALL display that request's current status (waiting, processing, done, failed).

---

### Requirement 2: Autentikasi osu! OAuth

**User Story:** As a player, I want to log in with my osu! account, so that the platform can access my username and play history for personalized features.

#### Acceptance Criteria

1. WHEN a user clicks the login button, THE system SHALL redirect the user to the official osu! OAuth authorization page.
2. WHEN osu! OAuth authorization succeeds, THE system SHALL store the user's osu! user ID, username, and access token in a server-side session.
3. WHEN osu! OAuth authorization fails or is cancelled, THE system SHALL redirect the user back to the main page and display an error message.
4. WHILE a user is authenticated, THE system SHALL display the user's osu! username in the navigation area.
5. WHEN a user clicks logout, THE system SHALL invalidate the server-side session and redirect the user to the main page as a guest.
6. IF an access token is expired, THEN THE system SHALL attempt to refresh the token using the stored refresh token before making osu! API calls.

---

### Requirement 3: Analisis Playstyle dari Riwayat Bermain

**User Story:** As an authenticated user, I want the system to analyze my play history, so that I can see my dominant playstyle based on maps I have played.

#### Acceptance Criteria

1. WHEN an authenticated user requests playstyle analysis, THE system SHALL allow the user to choose between top plays or recent plays as the data source.
2. WHEN a play history source is selected, THE system SHALL fetch the user's play history from the osu! API using the stored access token.
3. WHEN play history is fetched, THE system SHALL submit each beatmap in the history to the prediction queue respecting the 5-slot limit.
4. WHEN all beatmaps in the selected play history are predicted, THE system SHALL calculate the dominant playstyle as the playstyle label with the highest average probability across all predictions.
5. WHILE play history analysis is in progress, THE system SHALL display a progress indicator showing how many beatmaps have been processed out of the total.
6. IF a beatmap in the play history fails to be predicted, THEN THE system SHALL skip that beatmap and continue processing the remaining beatmaps.

---

### Requirement 4: Sistem Rekomendasi Map

**User Story:** As an authenticated user, I want to receive beatmap recommendations based on my playstyle, so that I can discover new maps that match how I play.

#### Acceptance Criteria

1. WHEN a user's dominant playstyle is determined, THE system SHALL query the beatmap database for maps tagged with that playstyle label.
2. WHEN displaying recommendations, THE system SHALL show beatmap metadata including beatmap ID, title, BPM, AR, CS, OD, object count, and playstyle tags.
3. WHEN the beatmap database has fewer than 5 maps matching the dominant playstyle, THE system SHALL include maps with secondary playstyle matches to fill the recommendations.
4. THE system SHALL provide an endpoint that accepts a beatmap prediction result and stores it in the beatmap database with its associated playstyle labels.
5. WHEN a beatmap is submitted for prediction via the standard prediction flow, THE system SHALL automatically store the prediction result in the beatmap database.
6. IF the beatmap database contains no maps matching the user's playstyle, THEN THE system SHALL display a message indicating recommendations are not yet available for that playstyle.

---

### Requirement 5: Database Beatmap dan Persistensi

**User Story:** As a system operator, I want prediction results to be stored persistently, so that the beatmap database grows over time and recommendations improve.

#### Acceptance Criteria

1. THE system SHALL use a PostgreSQL database running on the same Ubuntu server as the backend to store users, sessions, queue state, and beatmap prediction results.
2. WHEN a beatmap is successfully predicted, THE system SHALL store the beatmap ID, BPM, AR, CS, OD, object count, all predicted labels with probabilities, and timestamp in the database.
3. IF a beatmap ID already exists in the database, THEN THE system SHALL update the existing record with the new prediction result rather than creating a duplicate.
4. THE system SHALL expose an admin endpoint (protected by a static API key) that allows manual insertion or update of beatmap records with playstyle labels.
5. WHEN the backend restarts, THE system SHALL restore the active queue state from the database to prevent data loss.

---

### Requirement 6: Pengalaman Guest (Tanpa Login)

**User Story:** As a guest, I want to use the core prediction feature without logging in, so that I can try the tool before deciding to authenticate.

#### Acceptance Criteria

1. WHILE a user is not authenticated, THE system SHALL allow submission of beatmap links or file uploads for playstyle prediction using the existing queue system.
2. WHILE a user is not authenticated, THE system SHALL display prediction results without saving them to a user profile.
3. WHEN a guest attempts to access the play history analysis or recommendation features, THE system SHALL display a prompt to log in with osu! to access those features.
