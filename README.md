# WearHouse - Smart Digital Closet
A smart digital closet app designed to help users manage their wardrobe and plan outfits more efficiently. WearHouse addresses decision fatigue when choosing daily outfits by integrating calendar events and local weather forecasts to provide context-appropriate recommendations. Users can upload clothing images with automatic background removal, tag items by category/color/formality, and generate outfit combinations that avoid clashes and repeats while matching the day's context.

Adding an screenshot or a mockup of your application in action would be nice.  

![This is a screenshot.](images.png)

## Key Features

### Core Functionality
- **Smart Outfit Generation**: AI-powered recommendations based on weather, calendar events, and personal style
- **Digital Wardrobe**: Upload and organize clothing items with automatic background removal
- **Context-Aware Suggestions**: Integrates with calendar events and weather forecasts
- **Clothing Management**: Tag items by category, color, formality level, and season

### Technical Features
- **Automatic Background Removal**: Uses Remove.bg/rembg API for clean clothing visuals
- **Weather Integration**: Real-time weather data for appropriate clothing suggestions
- **Calendar Sync**: Event-based outfit recommendations (work, casual, formal)
- **Outfit Rules Engine**: Prevents color clashes, avoids recent repeats, matches formality

### Future Enhancements (Stretch Goals)
- **Avatar Try-On**: Preview outfits on personal photo or digital mannequin
- **Swipe Interface**: Tinder-like swiping for outfit selection
- **Style Analytics**: Track outfit patterns and preferences
# How to run
## Prerequisites
- Node.js (v16 or later)
- npm or yarn
- Supabase account for database and storage

## Setup Instructions
1. Clone the repository:
```bash
git clone https://github.com/your-username/wearhouse.git
cd wearhouse
```

2. Install dependencies:
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

3. Set up environment variables:
```bash
# Copy example env files
cp .env.example .env
# Edit .env with your Supabase credentials and API keys
```

4. Start the development servers:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

5. Open http://localhost:3000 in your browser 

# How to contribute
Follow this project board to know the latest status of the project: [Project Board](https://github.com/your-username/your-repo-name/projects/1)  

### How to build
- Use this github repository: [https://github.com/your-username/wearhouse](https://github.com/your-username/wearhouse)
- Follow this project board to know the latest status of the project: [Project Board](https://github.com/your-username/wearhouse/projects/1)
- Use the `main` branch for stable releases or `develop` branch for cutting edge development
- **Frontend**: React 18+ with TypeScript, Material-UI components
- **Backend**: Node.js with Express, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage for clothing images
- **External APIs**: Remove.bg/rembg for background removal, Weather API, Calendar API
- **Development Tools**: Vite (frontend), nodemon (backend)
- Expected behavior: App starts with authentication, then shows wardrobe management interface with outfit generation features 
