# Progress Report

## Day 1
- [x] Create a new repository on GitHub
- [x] Connect to MongoDB
- [x] Expose a REST API
  - [x] Self  
    - [x] Login
    - [x] Register
    - [x] Logout
    - [x] Get self info from DB
    - [x] Get self listings from DB
  - [x] User  
    - [x] Get user id from username
    - [x] Get user info from user id
    - [x] Get user listings from user id
  - [~] Messaging
    - [x] Initialize a channel
      - [x] channel between two users
      - [x] channel between multiple users
    - [x] Recipient(s) receive message via websockets
    - [ ] Recipient(s) receive message via push notifications 
    - [x] Send a message
      - [x] Send message when initializing channel
      - [x] Send message to already initialized channel
    - [x] Get messages
      - [x] Get messages from initialized channel
      - [x] Get messages from a specific time
    - [x] Search
      - [x] Search for users 
      - [x] Search for channels
      - [x] Search for messages
      - [x] Search for listings
    - [ ] Listings
      - [x] Create a listing 
      - [ ] Listing has geographical data (probably do on client).
-      
  - [x]     


## To run
npm run start

## To update code
npm run build


## To run latest code (you edited the project)
npm run build && npm run start

### If port 3000 is used
npm run build && PORT=3001 npm run start