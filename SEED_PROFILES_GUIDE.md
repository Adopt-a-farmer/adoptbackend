# 📚 Profile Seeding Script - Quick Reference

## Overview
This script creates comprehensive, verified profiles for:
- **2 Expert Profiles** (Agricultural specialists)
- **3 Farmer Profiles** (Different farm types)
- **3 Adopter Profiles** (Individual and organization)

All profiles are fully populated with realistic data and marked as verified.

---

## 🚀 How to Run

### Method 1: Using Node directly
```powershell
cd C:\Users\Administrator\Desktop\personal\jeremy\adoptbackend
node src/scripts/seedProfiles.js
```

### Method 2: Using npm script (if added to package.json)
```powershell
npm run seed:profiles
```

---

## 👥 Created Profiles

### 🎓 EXPERTS

#### 1. Dr. Sarah Wanjiru
- **Email:** sarah.wanjiru@agriexpert.ke
- **Password:** Expert@123
- **Specializations:** Crop Management, Soil Health, Organic Farming
- **Experience:** 15 years
- **Location:** Kiambu County
- **Rating:** 4.8/5 (42 reviews)
- **Mentorships:** 45 total, 8 active

#### 2. James Otieno
- **Email:** james.otieno@livestockexpert.ke
- **Password:** Expert@123
- **Specializations:** Livestock Care, Dairy Farming, Veterinary
- **Experience:** 12 years
- **Location:** Nakuru County
- **Rating:** 4.7/5 (30 reviews)
- **Mentorships:** 32 total, 6 active

---

### 🌾 FARMERS

#### 1. Peter Kamau - Green Valley Organic Farm
- **Email:** peter.kamau@greenfarm.ke
- **Password:** Farmer@123
- **Farm Type:** Organic Vegetables
- **Farm Size:** 10 acres
- **Location:** Kiambu County
- **Crops:** Kale, Tomatoes, Capsicum, Spinach
- **Certifications:** Organic Certification, GAP
- **Rating:** 4.6/5
- **Adopters:** 15 total, 8 active

#### 2. Mary Njeri - Sunrise Dairy Farm
- **Email:** mary.njeri@sunrisedairy.ke
- **Password:** Farmer@123
- **Farm Type:** Dairy & Mixed Farming
- **Farm Size:** 15 acres
- **Location:** Nakuru County
- **Livestock:** 50 Friesian cows, 200 chickens
- **Production:** 800 liters of milk daily
- **Rating:** 4.8/5
- **Adopters:** 22 total, 14 active

#### 3. David Mwangi - Golden Fields Coffee Estate
- **Email:** david.mwangi@goldenfields.ke
- **Password:** Farmer@123
- **Farm Type:** Premium Coffee & Macadamia
- **Farm Size:** 20 acres
- **Location:** Nyeri County
- **Crops:** Arabica Coffee (SL28, Ruiru 11), Macadamia
- **Certifications:** Rainforest Alliance, Specialty Coffee
- **Rating:** 4.9/5
- **Adopters:** 30 total, 18 active

---

### 💼 ADOPTERS

#### 1. Susan Akinyi
- **Email:** susan.akinyi@gmail.com
- **Password:** Adopter@123
- **Type:** Individual
- **Location:** Nairobi
- **Focus:** Organic farming, Vegetables, Coffee
- **Total Invested:** KES 125,000
- **Adoptions:** 5 total, 2 active
- **Risk Tolerance:** Medium

#### 2. John Odhiambo - TechCorp Kenya
- **Email:** john.odhiambo@techcorp.co.ke
- **Password:** Adopter@123
- **Type:** Organization
- **Organization:** TechCorp Kenya
- **Location:** Nairobi, Westlands
- **Focus:** Mixed farming, Sustainability
- **Total Invested:** KES 850,000
- **Adoptions:** 12 total, 5 active
- **Risk Tolerance:** High

#### 3. Grace Wambui
- **Email:** grace.wambui@diaspora.com
- **Password:** Adopter@123
- **Type:** Individual
- **Location:** Kiambu, Thika
- **Focus:** Dairy farming, Livestock
- **Total Invested:** KES 350,000
- **Adoptions:** 8 total, 3 active
- **Risk Tolerance:** Low

---

## ✅ What Gets Created

### For Each Expert:
- ✅ User account (verified, email confirmed)
- ✅ Complete expert profile
- ✅ Specializations and bio
- ✅ Education history (degrees, institutions)
- ✅ Certifications (with dates and organizations)
- ✅ Work experience
- ✅ Contact details and social media
- ✅ Availability schedule
- ✅ Location and service radius
- ✅ Statistics (mentorships, ratings, reviews)
- ✅ Pricing information
- ✅ 100% profile completeness

### For Each Farmer:
- ✅ User account (verified, email confirmed)
- ✅ Complete farmer profile
- ✅ Farm details (name, description, size)
- ✅ Location with coordinates
- ✅ Crop/livestock details
- ✅ Farming practices and methods
- ✅ Certifications
- ✅ Contact info and social media
- ✅ Bank details for payments
- ✅ Adoption statistics
- ✅ Ratings and reviews

### For Each Adopter:
- ✅ User account (verified, email confirmed)
- ✅ Complete adopter profile
- ✅ Personal/Organization details
- ✅ Location information
- ✅ Investment preferences
- ✅ Farming interests
- ✅ Payment methods
- ✅ Adoption history
- ✅ Notification preferences

---

## 🔧 Troubleshooting

### Error: "User already exists"
This is normal if you run the script multiple times. The script will skip existing users.

### Error: "Cannot connect to database"
Check your `.env` file has the correct `MONGO_URI`:
```bash
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name
```

### Error: "Module not found"
Make sure you're in the backend directory:
```powershell
cd C:\Users\Administrator\Desktop\personal\jeremy\adoptbackend
```

---

## 🧪 Testing the Seeded Data

### Test Expert Login:
```javascript
POST /api/auth/login
{
  "email": "sarah.wanjiru@agriexpert.ke",
  "password": "Expert@123"
}
```

### Test Farmer Login:
```javascript
POST /api/auth/login
{
  "email": "peter.kamau@greenfarm.ke",
  "password": "Farmer@123"
}
```

### Test Adopter Login:
```javascript
POST /api/auth/login
{
  "email": "susan.akinyi@gmail.com",
  "password": "Adopter@123"
}
```

---

## 📝 Notes

- All passwords follow the pattern: `[Role]@123`
- All users are pre-verified (no email verification needed)
- All profiles have 100% or near-100% completeness
- Realistic data based on Kenyan agricultural context
- All contact details are fictional but properly formatted

---

## 🔄 To Re-seed

If you need to start fresh:

1. **Delete existing data:**
   ```javascript
   // In MongoDB or through an admin panel
   // Delete users with emails from the seed data
   ```

2. **Run the script again:**
   ```powershell
   node src/scripts/seedProfiles.js
   ```

---

## 📊 Use Cases

This seeded data is perfect for:
- ✅ Development and testing
- ✅ Demo presentations
- ✅ UI/UX testing with realistic data
- ✅ Testing adoption workflows
- ✅ Testing expert-farmer matching
- ✅ Testing payment flows
- ✅ Integration testing

---

**Created:** October 15, 2025  
**Script Location:** `src/scripts/seedProfiles.js`
