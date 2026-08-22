# Refurnish (Ignition Hacks V7 submission)

Refurnish is a web application that allows users to scan real-world rooms using their smartphone, then virtually stage those rooms with 3D furniture models. The application uses World Labs' Marble API for 3D reconstruction from video footage.

## Features
- **3D Room Scanning**: Upload a video of your room and get a photorealistic 3D scan
- **Virtual Staging**: Place and arrange 3D furniture models in your scanned room
- **Multiple View Modes**: Choose between photorealistic view and fast mesh view
- **Catalog Management**: Browse and manage a catalog of 3D furniture models

## Setup

### Notice
If you want to use the website right now, there's no need to setup locally! Thanks to Render, you can just visit https://ignitionhacks.onrender.com/ and enjoy the experience.

### .env
Create `root/ignitionhacks26/backend/.env` with the following variables:

```env
# DB config
SPRING_DATASOURCE_URL=jdbc:postgresqldpg-da3s0hu1egvs73ao25vg-a.virginia-postgres.render.com/database_z40gast
SPRING_DATASOURCE_USERNAME=INSERT_DB_USERNAME
SPRING_DATASOURCE_PASSWORD=INSERT_DB_PASSWORD

# MinIO storage (for file uploads)
MINIO_ROOT_USER=INSERT_MINIO_USERNAME
MINIO_ROOT_PASSWORD=INSERT_MINIO_PASSWORD
MINIO_ENDPOINT=https://minio-server-byne.onrender.com/
MINIO_PUBLIC_URL=https://minio-server-byne.onrender.com/
MINIO_BUCKET=furniture

# Gemini API (dimension estimation)
GEMINI_API_KEY=INSERT_GEMINI_API_KEY
```

### Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Build the Spring Boot application:
   ```bash
   mvn clean install
   ```

3. Run the application:
   ```bash
   mvn spring-boot:run
   ```

The backend will start on port 8080 by default.

### Frontend
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:8080`.

## How to use
1. **Upload a Room**:
   - Click "New Room" and upload a video of your room
   - The video will be processed by World Labs Marble API (takes ~5 minutes)
   - Once processed, you'll be redirected to the editor

2. **Edit a Room**:
   - Left-click and drag to rotate the view
   - Right-click and drag to pan
   - Scroll to zoom in/out
   - Select furniture from the catalog panel
   - Drag and drop models into the scene
   - Use the transform tools to position models

3. **Switch View Modes**:
   - Photoreal: High-quality splat rendering (default)
   - Mesh: Fast wireframe mesh rendering
