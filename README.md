# WearHouse POC

Proof of concept for a smart digital wardrobe. Demonstrates:  
- Uploading clothes with metadata.  
- Background removal via a Node/Express proxy to **remove.bg**.  
- Storage in **Supabase** (Postgres + Storage).  
- Simple rules-based outfit generator (mocked calendar + weather).  

---

## Tech Stack
- **Frontend:** React + Vite  
- **Backend Proxy:** Node.js + Express  
- **Database & Storage:** Supabase  
- **Image Processing:** remove.bg API  

---

## Setup
0. Version:
   Microsoft Windows 10, Version 22H2 (OS Build 19045.6332)
   npm Version 10.5.0
   node Version 20.13.1

1. Clone and navigate to the project:  
   ```bash
   git clone https://github.com/YOUR-USERNAME/wearhouse-poc.git
   cd wearhouse-poc/WearHouse/wearhouse-poc
   npm install
   ```

2. Start proxy server (in a separate terminal, from `wearhouse-poc/server` directory):  
   ```bash
   cd server
   npm install
   npm start
   ```

3. Run frontend (from `wearhouse-poc` directory):  
   ```bash
   npm install
   npm run dev
   ```

---

## Usage
- Upload an image → proxy removes background → file stored in Supabase.  
- Metadata saved in DB.  
- Items display in grid.  
- “Suggest Outfit” picks a top + bottom using mock calendar/weather.  





Disclaimer: Some code in this repository was generated using AI.