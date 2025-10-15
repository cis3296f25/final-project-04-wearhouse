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
1. Clone and install:  
   ```bash
   git clone https://github.com/YOUR-USERNAME/wearhouse-poc.git
   cd wearhouse-poc 
   npm install
   ```
2. Create Supabase project, bucket `items`, and `items` table.  
3. Add `.env` in root:  
   ```
   VITE_SUPABASE_URL=your-url
   VITE_SUPABASE_ANON=your-anon-key
   VITE_REMOVE_BG_PROXY=http://localhost:3001/remove-bg
   ```
4. Start proxy (in `/server`):  
   ```bash
   npm install
   echo "REMOVE_BG_KEY=your-removebg-key" > .env
   npm start
   ```
5. Run frontend:  
   ```bash
   npm run dev
   ```

---

## Usage
- Upload an image → proxy removes background → file stored in Supabase.  
- Metadata saved in DB.  
- Items display in grid.  
- “Suggest Outfit” picks a top + bottom using mock calendar/weather.  





Disclaimer: Some code in this repository was generated using AI.