// src/config/firebase.js
const admin = require('firebase-admin');

// 다운로드한 서비스 계정 키 파일 경로
const serviceAccount = require('../../firebase-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET // .env 파일에 설정된 버킷 주소
});

const bucket = admin.storage().bucket();

module.exports = { bucket };