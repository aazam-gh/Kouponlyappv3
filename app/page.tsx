"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  CakeSlice,
  Check,
  ChefHat,
  ChevronRight,
  Clapperboard,
  Coffee,
  CookingPot,
  Compass,
  CupSoda,
  Dumbbell,
  EggFried,
  Gift,
  GraduationCap,
  Heart,
  Home,
  Info,
  Laptop,
  Map as MapIcon,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  Phone,
  Plane,
  Popcorn,
  Rocket,
  Salad,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Target,
  TicketPercent,
  Trophy,
  UserRound,
  Utensils,
  UtensilsCrossed,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

type Tab = "explore" | "search" | "map" | "saved" | "profile";
type SearchSort = "Trending" | "A-Z" | "Highest offer" | "Newest" | "Nearest";
type WorkTrack = "creator" | "bd" | "marketing" | "campus";
type AccountPageKey = "personal" | "savings" | "earnings" | "membership" | "gifts" | "settings" | "help" | "feedback" | "legal";

type UtilityDialogData = {
  eyebrow: string;
  title: string;
  body: string;
  details?: string[];
  primaryLabel?: string;
  primaryHref?: string;
};

type Deal = {
  id: number;
  name: string;
  place: string;
  category: string;
  distance: string;
  rating: string;
  offer: string;
  saving: string;
  image: string;
  color: string;
  logo?: string;
  distanceKm: number;
  offerValue: number;
  newest: number;
  trend: number;
  description: string;
};

type DirectoryItem = {
  id: string;
  type: "Vendor" | "Offer" | "Experience" | "Course" | "Internship" | "Freelance" | "Job" | "Prize";
  title: string;
  subtitle: string;
  tag: string;
  offer: number;
  newest: number;
  trend: number;
  distance: number;
  image: string;
  logo?: string;
  dealId?: number;
  keywords: string;
  description: string;
  action: string;
  destination?: "work" | "rewards";
  externalUrl?: string;
  redemption?: "online" | "inStore";
};

type RewardItem = {
  name: string;
  detail: string;
  points: number;
  image: string;
};

const categories = [
  { name: "Mains", search: "mains", icon: CookingPot, image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=500&q=88" },
  { name: "Snacks", search: "snacks", icon: Popcorn, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=500&q=88" },
  { name: "Drinks", search: "drinks", icon: CupSoda, image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=500&q=88" },
  { name: "Sweets", search: "sweets", icon: CakeSlice, image: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=500&q=88" },
  { name: "Cuisines", search: "cuisines", icon: ChefHat, image: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=500&q=88" },
  { name: "Dietary", search: "dietary", icon: Salad, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=88" },
  { name: "Breakfast", search: "breakfast", icon: EggFried, image: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=500&q=88" },
  { name: "Buffet", search: "buffet", icon: UtensilsCrossed, image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=500&q=88" },
  { name: "Beauty", search: "beauty", icon: Sparkles, image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=500&q=88" },
  { name: "Fitness", search: "fitness", icon: Dumbbell, image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=500&q=88" },
  { name: "Things to do", search: "experience", icon: Compass, image: "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=500&q=88" },
  { name: "Staycations", search: "staycation", icon: CalendarDays, image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=500&q=88" },
  { name: "Shopping", search: "shopping", icon: Store, image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=500&q=88" },
  { name: "Entertainment", search: "entertainment", icon: Clapperboard, image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=88" },
  { name: "Travel", search: "travel", icon: Plane, image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=500&q=88" },
  { name: "Learn", search: "course", icon: GraduationCap, image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=500&q=88" },
  { name: "Internships", search: "internship", icon: BriefcaseBusiness, image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=500&q=88" },
  { name: "Freelance", search: "freelance", icon: Laptop, image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=500&q=88" },
];

const categoryDetails = {
  Mains: { icon: CookingPot, image: categories[0].image, description: "Big, satisfying plates made for hungry Kochi days.", match: ["mains", "biryani", "burger", "pizza", "shawarma", "noodles", "pasta", "seafood", "steak"], subcategories: [{ label: "All", terms: [] }, { label: "Biryani", terms: ["biryani"] }, { label: "Burgers", terms: ["burger"] }, { label: "Pizza", terms: ["pizza"] }, { label: "Shawarma", terms: ["shawarma"] }, { label: "Noodles", terms: ["noodles"] }, { label: "Pasta", terms: ["pasta"] }, { label: "Seafood", terms: ["seafood"] }, { label: "Steaks", terms: ["steak"] }] },
  Snacks: { icon: Popcorn, image: categories[1].image, description: "Quick bites, shareable plates and the good stuff between meals.", match: ["snacks", "fries", "wraps", "momos", "sandwiches", "wings", "tacos"], subcategories: [{ label: "All", terms: [] }, { label: "Fries", terms: ["fries"] }, { label: "Wraps", terms: ["wrap"] }, { label: "Momos", terms: ["momo"] }, { label: "Sandwiches", terms: ["sandwich"] }, { label: "Wings", terms: ["wing"] }, { label: "Tacos", terms: ["taco"] }] },
  Drinks: { icon: CupSoda, image: categories[2].image, description: "Coffee runs, refreshing sips and something cold for the walk home.", match: ["drinks", "coffee", "tea", "boba", "juice", "shake", "smoothie"], subcategories: [{ label: "All", terms: [] }, { label: "Coffee", terms: ["coffee"] }, { label: "Tea", terms: ["tea", "chai"] }, { label: "Boba", terms: ["boba", "bubble"] }, { label: "Juices", terms: ["juice"] }, { label: "Shakes", terms: ["shake"] }, { label: "Smoothies", terms: ["smoothie"] }] },
  Sweets: { icon: CakeSlice, image: categories[3].image, description: "Little treats, celebration cakes and sweet reasons to meet up.", match: ["sweets", "cake", "ice-cream", "ice cream", "pastry", "donut", "waffle"], subcategories: [{ label: "All", terms: [] }, { label: "Cakes", terms: ["cake"] }, { label: "Ice-Cream", terms: ["ice cream", "ice-cream"] }, { label: "Pastries", terms: ["pastry"] }, { label: "Donuts", terms: ["donut"] }, { label: "Waffles", terms: ["waffle"] }] },
  Cuisines: { icon: ChefHat, image: categories[4].image, description: "Find the flavour you are craving, from Kerala classics to Tokyo bowls.", match: ["cuisines", "arabic", "chinese", "indian", "italian", "mexican", "thai", "japanese"], subcategories: [{ label: "All", terms: [] }, { label: "Arabic", terms: ["arabic"] }, { label: "Chinese", terms: ["chinese"] }, { label: "Indian", terms: ["indian", "kerala"] }, { label: "Italian", terms: ["italian"] }, { label: "Mexican", terms: ["mexican"] }, { label: "Thai", terms: ["thai"] }, { label: "Japanese", terms: ["japanese"] }] },
  Dietary: { icon: Salad, image: categories[5].image, description: "Feel-good picks that fit the way you like to eat.", match: ["dietary", "healthy", "salad", "vegan", "keto", "bowl"], subcategories: [{ label: "All", terms: [] }, { label: "Healthy", terms: ["healthy"] }, { label: "Salads", terms: ["salad"] }, { label: "Vegan", terms: ["vegan"] }, { label: "Keto", terms: ["keto"] }, { label: "Bowls", terms: ["bowl"] }] },
  Breakfast: { icon: EggFried, image: categories[6].image, description: "Start slow or start strong with breakfast favourites around Kochi.", match: ["breakfast", "omelette", "pancake", "toast", "bagel", "crepe"], subcategories: [{ label: "All", terms: [] }, { label: "Omelettes", terms: ["omelette"] }, { label: "Pancakes", terms: ["pancake"] }, { label: "Toast", terms: ["toast"] }, { label: "Bagels", terms: ["bagel"] }, { label: "Crepes", terms: ["crepe"] }] },
  Buffet: { icon: UtensilsCrossed, image: categories[7].image, description: "Come hungry: platters, thalis and generous all-you-can-eat plans.", match: ["buffet", "platter", "thali", "banquet", "feast", "unlimited"], subcategories: [{ label: "All", terms: [] }, { label: "Platters", terms: ["platter"] }, { label: "Thalis", terms: ["thali"] }, { label: "Banquets", terms: ["banquet"] }, { label: "Feasts", terms: ["feast"] }, { label: "Unlimited", terms: ["unlimited"] }] },
  Dining: { icon: Utensils, image: categories[0].image, description: "Meals, quick bites and student-friendly tables around Kochi.", match: ["dining", "food", "restaurant", "meal", "biryani"], subcategories: [{ label: "All", terms: [] }, { label: "Meals", terms: ["meal", "lunch", "dinner"] }, { label: "Biryani", terms: ["biryani"] }, { label: "Fast food", terms: ["burger", "chicken", "fast"] }, { label: "Under ₹100", terms: ["under 100", "₹99", "₹89"] }] },
  Cafes: { icon: Coffee, image: categories[1].image, description: "Coffee, breakfast and good places to study or catch up.", match: ["cafes", "cafe", "coffee", "breakfast"], subcategories: [{ label: "All", terms: [] }, { label: "Coffee", terms: ["coffee"] }, { label: "Breakfast", terms: ["breakfast", "brunch"] }, { label: "Study friendly", terms: ["study", "student"] }, { label: "Desserts", terms: ["dessert", "cake"] }] },
  Beauty: { icon: Sparkles, image: categories[2].image, description: "Salon, self-care and wellness offers without the full-price guilt.", match: ["beauty", "salon", "spa", "skincare", "hair"], subcategories: [{ label: "All", terms: [] }, { label: "Hair", terms: ["hair", "salon"] }, { label: "Nails", terms: ["nail", "manicure"] }, { label: "Spa", terms: ["spa", "massage"] }, { label: "Skincare", terms: ["skin", "beauty"] }] },
  Fitness: { icon: Dumbbell, image: categories[3].image, description: "Gyms, sports and beginner-friendly ways to get moving.", match: ["fitness", "gym", "sports", "workout", "training"], subcategories: [{ label: "All", terms: [] }, { label: "Gyms", terms: ["gym", "strength"] }, { label: "Sports", terms: ["sports", "padel"] }, { label: "Classes", terms: ["class", "training", "coached"] }, { label: "Free trials", terms: ["free", "trial"] }] },
  "Things to do": { icon: Compass, image: categories[4].image, description: "Easy plans for dates, groups and weekends worth remembering.", match: ["things to do", "experience", "activity", "tour", "outdoor"], subcategories: [{ label: "All", terms: [] }, { label: "Adventure", terms: ["adventure", "kayak", "cycling"] }, { label: "Workshops", terms: ["workshop", "pottery", "clay"] }, { label: "Tours", terms: ["tour", "walk", "cruise"] }, { label: "Water", terms: ["water", "pool", "kayak"] }] },
  Staycations: { icon: CalendarDays, image: categories[5].image, description: "Short Kerala escapes, pool days and slow weekends nearby.", match: ["staycations", "staycation", "hotel", "resort", "stay"], subcategories: [{ label: "All", terms: [] }, { label: "City stays", terms: ["city", "hotel", "kochi"] }, { label: "Beach", terms: ["beach", "cherai"] }, { label: "Backwaters", terms: ["backwater", "kumbalangi"] }, { label: "Pool day", terms: ["pool", "day pass"] }] },
  Shopping: { icon: Store, image: categories[6].image, description: "Fashion, tech and useful finds with member-only prices.", match: ["shopping", "fashion", "retail", "tech", "store"], subcategories: [{ label: "All", terms: [] }, { label: "Fashion", terms: ["fashion", "clothes", "thread"] }, { label: "Tech", terms: ["tech", "electronics", "gadget"] }, { label: "Local", terms: ["local", "kochi"] }, { label: "Accessories", terms: ["accessories"] }] },
  Entertainment: { icon: Clapperboard, image: categories[7].image, description: "Cinema, gaming and fun plans for when the group chat agrees.", match: ["entertainment", "cinema", "movie", "gaming", "events"], subcategories: [{ label: "All", terms: [] }, { label: "Cinema", terms: ["cinema", "movie", "ticket"] }, { label: "Gaming", terms: ["gaming", "arcade", "game"] }, { label: "Events", terms: ["event"] }, { label: "For groups", terms: ["friends", "team", "group"] }] },
  Travel: { icon: Plane, image: categories[8].image, description: "Flights, weekend trips and practical ways to see more for less.", match: ["travel", "trip", "flight", "holiday", "tour"], subcategories: [{ label: "All", terms: [] }, { label: "Weekend trips", terms: ["weekend", "short-break"] }, { label: "Flights", terms: ["flight", "airport", "fare"] }, { label: "Road trips", terms: ["road", "rental", "drive"] }, { label: "Tours", terms: ["tour", "holiday"] }] },
  Learn: { icon: GraduationCap, image: categories[9].image, description: "Short courses and practical skills that move your profile forward.", match: ["learn", "course", "skills", "workshop", "career"], subcategories: [{ label: "All", terms: [] }, { label: "Free", terms: ["free"] }, { label: "Career skills", terms: ["career", "portfolio"] }, { label: "Design", terms: ["design"] }, { label: "Online", terms: ["online", "remote"] }] },
  Internships: { icon: BriefcaseBusiness, image: categories[10].image, description: "Student-friendly internships, including opportunities with Kouponly.", match: ["internship", "internships", "intern", "trainee"], subcategories: [{ label: "All", terms: [] }, { label: "Marketing", terms: ["marketing"] }, { label: "Sales", terms: ["sales", "business development"] }, { label: "Design", terms: ["design", "product"] }, { label: "Remote", terms: ["remote", "hybrid"] }] },
  Freelance: { icon: Laptop, image: categories[11].image, description: "Local and remote gigs for creators, designers and student talent.", match: ["freelance", "creator", "ugc", "gig", "project"], subcategories: [{ label: "All", terms: [] }, { label: "UGC", terms: ["ugc", "creator", "video"] }, { label: "Design", terms: ["design", "logo", "graphics"] }, { label: "Video", terms: ["video", "social"] }, { label: "Photography", terms: ["photo", "shoot"] }] },
  Jobs: { icon: BriefcaseBusiness, image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=500&q=88", description: "Flexible part-time and entry-level roles across Kochi and Kerala.", match: ["job", "part-time", "trainee", "work"], subcategories: [{ label: "All", terms: [] }, { label: "Part-time", terms: ["part-time", "weekend"] }, { label: "Remote", terms: ["remote", "hybrid"] }, { label: "Retail", terms: ["retail", "store"] }, { label: "Events", terms: ["event", "crew"] }] },
};

type CategoryName = keyof typeof categoryDetails;

const deals: Deal[] = [
  { id: 1, name: "Paragon Restaurant", place: "Lulu Mall, Edappally", category: "Dining", distance: "2.1 km", distanceKm: 2.1, rating: "4.8", offer: "Buy one biryani, get one free", saving: "Save up to ₹480", offerValue: 480, newest: 15, trend: 99, image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=900&q=90", color: "#ffe8de", description: "A Kerala favourite for biryani, seafood and generous family meals." },
  { id: 2, name: "Starbucks", place: "Panampilly Nagar", category: "Cafes", distance: "1.3 km", distanceKm: 1.3, rating: "4.7", offer: "Buy one handcrafted drink, get one free", saving: "Save ₹320", offerValue: 320, newest: 10, trend: 98, image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=90", logo: "https://cdn.simpleicons.org/starbucks/00754A", color: "#e5f1e9", description: "Your familiar coffee stop for quick catch-ups, study sessions and an afternoon reset." },
  { id: 3, name: "KFC", place: "Centre Square Mall", category: "Dining", distance: "0.8 km", distanceKm: .8, rating: "4.6", offer: "Two Zinger combos for ₹499", saving: "Save ₹260", offerValue: 260, newest: 13, trend: 97, image: "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=900&q=90", logo: "https://cdn.simpleicons.org/kfc/F40027", color: "#ffe8e8", description: "Crispy chicken, quick combos and an easy meal with friends." },
  { id: 4, name: "Burger King", place: "Lulu Mall, Edappally", category: "Dining", distance: "3.2 km", distanceKm: 3.2, rating: "4.6", offer: "Buy one Whopper, get one free", saving: "Save ₹289", offerValue: 289, newest: 8, trend: 96, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=90", logo: "https://cdn.simpleicons.org/burgerking/D62300", color: "#fff0df", description: "Flame-grilled burgers, fries and quick-value combos." },
  { id: 5, name: "Kashi Art Cafe", place: "Fort Kochi", category: "Cafes", distance: "8.4 km", distanceKm: 8.4, rating: "4.9", offer: "Brunch for two at a member price", saving: "Save up to ₹650", offerValue: 650, newest: 16, trend: 95, image: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=900&q=90", color: "#f4ece7", description: "A leafy Fort Kochi cafe loved for slow breakfasts, art and relaxed afternoons." },
  { id: 6, name: "Naturals Salon", place: "Kadavanthra", category: "Beauty", distance: "1.9 km", distanceKm: 1.9, rating: "4.8", offer: "Hair spa and styling, 40% off", saving: "Save ₹900", offerValue: 900, newest: 14, trend: 92, image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=90", color: "#f7e9ef", description: "Reliable salon services and a quick reset close to the city centre." },
  { id: 7, name: "Kochi Marriott", place: "Edappally", category: "Staycations", distance: "3.1 km", distanceKm: 3.1, rating: "4.8", offer: "Pool day and lunch for two", saving: "Save ₹1,800", offerValue: 1800, newest: 17, trend: 97, image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=90", logo: "https://cdn.simpleicons.org/marriott/8B1D41", color: "#e8f1fb", description: "A polished city staycation with pool time, a good lunch and no long drive." },
  { id: 8, name: "Nykaa Luxe", place: "Lulu Mall, Edappally", category: "Beauty", distance: "3.2 km", distanceKm: 3.2, rating: "4.7", offer: "20% off selected beauty favourites", saving: "Save up to ₹800", offerValue: 800, newest: 12, trend: 93, image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=90", color: "#f8e5ed", description: "Beauty discoveries, new launches and reliable favourites in one place." },
  { id: 9, name: "Decathlon", place: "Vyttila", category: "Fitness", distance: "4.5 km", distanceKm: 4.5, rating: "4.7", offer: "Member price on selected sports gear", saving: "Save up to ₹1,100", offerValue: 1100, newest: 9, trend: 91, image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=90", logo: "https://www.google.com/s2/favicons?domain=decathlon.in&sz=128", color: "#e8effb", description: "Sports gear for first tries, regular routines and outdoor weekends." },
  { id: 10, name: "Westside", place: "Forum Mall, Maradu", category: "Shopping", distance: "5.2 km", distanceKm: 5.2, rating: "4.6", offer: "Extra 15% off your member basket", saving: "Save up to ₹1,250", offerValue: 1250, newest: 7, trend: 88, image: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=90", color: "#f1edf5", description: "Easy wardrobe updates, accessories and home finds under one roof." },
  { id: 11, name: "IndiGo", place: "Cochin International Airport", category: "Travel", distance: "24 km", distanceKm: 24, rating: "4.7", offer: "Member fares on selected weekend routes", saving: "Save up to ₹2,500", offerValue: 2500, newest: 11, trend: 94, image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=90", color: "#e8eafa", description: "Short-break fares and simple connections from Kochi to your next city." },
  { id: 12, name: "PVR Cinemas", place: "Lulu Mall, Edappally", category: "Entertainment", distance: "3.2 km", distanceKm: 3.2, rating: "4.7", offer: "Two premium tickets for ₹499", saving: "Save ₹350", offerValue: 350, newest: 6, trend: 90, image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=90", color: "#eee8f5", description: "A big-screen night with comfortable seats and more money left for popcorn." },
  { id: 13, name: "Wonderla Kochi", place: "Pallikkara", category: "Activities", distance: "16 km", distanceKm: 16, rating: "4.8", offer: "Waterpark entry, 25% off", saving: "Save ₹750", offerValue: 750, newest: 5, trend: 93, image: "https://images.unsplash.com/photo-1576610616656-d3aa5d1f4534?auto=format&fit=crop&w=900&q=90", color: "#e0f3f5", description: "Water rides, thrill rides and a full high-energy day with friends." },
  { id: 14, name: "Croma", place: "Oberon Mall, Edappally", category: "Shopping", distance: "4 km", distanceKm: 4, rating: "4.5", offer: "10% off selected accessories", saving: "Save up to ₹1,500", offerValue: 1500, newest: 4, trend: 86, image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=90", color: "#e7f2ef", description: "Tech, accessories and practical upgrades with clear member pricing." },
  { id: 15, name: "Chicking", place: "Marine Drive", category: "Dining", distance: "1 km", distanceKm: 1, rating: "4.6", offer: "Family chicken bucket at ₹699", saving: "Save ₹420", offerValue: 420, newest: 3, trend: 89, image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=900&q=90", color: "#ffe8d9", description: "A Kerala-born quick-service favourite for crispy chicken and family combos." },
  { id: 16, name: "Cinepolis", place: "Centre Square Mall", category: "Entertainment", distance: "0.8 km", distanceKm: .8, rating: "4.6", offer: "Buy one cinema ticket, get one free", saving: "Save ₹300", offerValue: 300, newest: 2, trend: 87, image: "https://images.unsplash.com/photo-1586899028174-e7098604235b?auto=format&fit=crop&w=900&q=90", color: "#e9e8f5", description: "An easy central movie plan with comfortable screens and member savings." },
];

const placeholderPartnerSeeds = [
  ["Malabar Table", "Dining", "Kakkanad", "25% off your bill", 420, 4.8, "food restaurant lunch dinner Kerala", "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=88"],
  ["Pepper House Kitchen", "Dining", "Fort Kochi", "Buy one main, get one free", 520, 7.1, "food restaurant seafood dining", "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=88"],
  ["Bean Route", "Cafes", "Kadavanthra", "Second coffee free", 260, 1.7, "coffee cafe study breakfast", "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=900&q=88"],
  ["Coastline Coffee", "Cafes", "Marine Drive", "Coffee and cake for ₹299", 220, 1.2, "coffee cafe dessert bakery", "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=88"],
  ["Glow & Co", "Beauty", "Panampilly Nagar", "40% off first service", 850, 1.4, "beauty salon skincare hair wellness", "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=88"],
  ["Studio Eleven", "Beauty", "Edappally", "Member makeover package", 1100, 3.5, "beauty makeup salon spa", "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=88"],
  ["Everyday Fitness", "Fitness", "Vyttila", "One month at 50% off", 900, 4.2, "fitness gym workout health", "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=88"],
  ["Paddle Club Kochi", "Fitness", "Kakkanad", "Free beginner session", 650, 5.4, "fitness sports padel activity", "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=88"],
  ["Fort Kochi Walks", "Things to do", "Fort Kochi", "Two tickets for ₹799", 500, 7.5, "experience activity tour heritage", "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=900&q=88"],
  ["Kerala Kayak Club", "Things to do", "Kadamakkudy", "30% off sunrise kayaking", 450, 11.0, "experience activity outdoor kayak", "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=900&q=88"],
  ["Backwater Stays", "Staycations", "Kumbalangi", "Stay and breakfast from ₹2,499", 1500, 12.0, "hotel staycation resort weekend", "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=88"],
  ["Munnar Weekend Co", "Staycations", "Munnar", "Save 35% on two nights", 2600, 108.0, "hotel staycation travel resort", "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=900&q=88"],
  ["Local Thread Store", "Shopping", "Panampilly Nagar", "Extra 20% off", 700, 1.6, "shopping fashion clothes local", "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=88"],
  ["Tech Corner Kochi", "Shopping", "Edappally", "Accessories from ₹299", 1000, 3.9, "shopping electronics tech gadgets", "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=88"],
  ["Indie Screen Club", "Entertainment", "Kaloor", "Two tickets, one price", 340, 2.4, "entertainment movies cinema events", "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=88"],
  ["Game Zone Kochi", "Entertainment", "Lulu Mall", "60 minutes for ₹399", 300, 3.2, "entertainment gaming arcade fun", "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=88"],
  ["Weekend Wheels", "Travel", "Kochi", "20% off self-drive rentals", 1300, 2.0, "travel rental road trip transport", "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=88"],
  ["Kerala Escape Co", "Travel", "Online", "Member prices on weekend trips", 2200, 0, "travel holiday tours booking online", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=88"],
  ["SkillSpring", "Learn", "Online", "First course free", 900, 0, "learn course skills education online", "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=88"],
  ["Career Launch Kerala", "Learn", "Kochi", "Free career starter workshop", 600, 2.8, "learn career course workshop skills", "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=88"],
  ["Campus Connect", "Internships", "Kerala colleges", "Student opportunities weekly", 0, 0, "internship student campus work jobs", "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=900&q=88"],
  ["LaunchPad Internships", "Internships", "Kochi", "Paid roles for students", 0, 2.2, "internship student paid work jobs", "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=88"],
  ["Creator Studio Co", "Freelance", "Remote", "Creator briefs from ₹3,000", 0, 0, "freelance creator ugc video gigs", "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=900&q=88"],
  ["Kerala Freelance Desk", "Freelance", "Remote", "New local projects daily", 0, 0, "freelance remote projects earn work", "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=88"],
] as const;

const supplementalPartnerSeeds = [
  ["Calicut Bites", "Dining", "Kaloor", "Kerala meals for two at ₹499", 380, 2.6, "food restaurant meals local", "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=88"],
  ["Cassava Kitchen", "Dining", "Panampilly Nagar", "20% off your table", 450, 1.5, "food restaurant Kerala dinner", "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=88"],
  ["Harbour Meals", "Dining", "Marine Drive", "Seafood lunch from ₹399", 360, 1.1, "food seafood restaurant lunch", "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=88"],
  ["French Toast Corner", "Cafes", "Kacheripady", "Breakfast combo at ₹349", 240, 2.0, "coffee cafe brunch breakfast", "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=88"],
  ["Cocoa Tree Cafe", "Cafes", "MG Road", "Dessert and coffee for two", 300, 1.0, "coffee cafe dessert date", "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=900&q=88"],
  ["Study Brew", "Cafes", "Kakkanad", "Unlimited study coffee at ₹299", 280, 5.1, "coffee cafe study students", "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=900&q=88"],
  ["Lime Light Studio", "Beauty", "Palarivattom", "Haircut and spa at 35% off", 780, 3.0, "beauty salon hair spa", "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=88"],
  ["Nail Room Kochi", "Beauty", "Kadavanthra", "Gel manicure at ₹699", 520, 1.8, "beauty nails salon wellness", "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=88"],
  ["Care & Glow Spa", "Beauty", "Edappally", "Couple spa at 30% off", 1250, 3.7, "beauty spa wellness massage", "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=88"],
  ["Core Club", "Fitness", "Panampilly Nagar", "Free seven-day trial", 700, 1.4, "fitness gym workout trial", "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=900&q=88"],
  ["Flex Yard", "Fitness", "Kakkanad", "Strength starter month at ₹999", 950, 5.3, "fitness strength gym training", "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=900&q=88"],
  ["Run Kochi Studio", "Fitness", "Kaloor", "Five coached sessions for ₹799", 600, 2.4, "fitness running training sports", "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?auto=format&fit=crop&w=900&q=88"],
  ["Escape Room Kochi", "Things to do", "Edappally", "Team entry at 25% off", 650, 3.6, "experience activity games friends", "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=88"],
  ["Clay Story Studio", "Things to do", "Mattancherry", "Pottery date for two", 500, 7.0, "experience pottery art workshop", "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=88"],
  ["Island Cycling Club", "Things to do", "Kadamakkudy", "Sunset cycle tour at ₹599", 450, 10.6, "experience cycling outdoor tour", "https://images.unsplash.com/photo-1528629297340-d1d466945dc5?auto=format&fit=crop&w=900&q=88"],
  ["Cherai Weekend House", "Staycations", "Cherai", "Beach stay from ₹2,899", 1800, 24, "hotel staycation beach weekend", "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=900&q=88"],
  ["Fort Heritage Rooms", "Staycations", "Fort Kochi", "Second night at 50% off", 2100, 8.2, "hotel heritage stay weekend", "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=88"],
  ["Athirappilly Escape", "Staycations", "Athirappilly", "Couple retreat from ₹3,499", 2400, 58, "hotel nature staycation resort", "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=900&q=88"],
  ["The Wardrobe Edit", "Shopping", "Kaloor", "Extra 25% off student styles", 780, 2.5, "shopping fashion student clothes", "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=88"],
  ["Kerala Craft House", "Shopping", "Fort Kochi", "Member prices on handmade gifts", 550, 8.1, "shopping crafts gifts local", "https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=900&q=88"],
  ["Sneaker District", "Shopping", "Edappally", "Selected pairs at 20% off", 1400, 3.4, "shopping shoes sneakers fashion", "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=88"],
  ["Laugh Lounge Kochi", "Entertainment", "MG Road", "Two comedy passes at ₹499", 420, 1.2, "entertainment comedy event night", "https://images.unsplash.com/photo-1527224857830-43a7acc85260?auto=format&fit=crop&w=900&q=88"],
  ["Board Game Social", "Entertainment", "Panampilly Nagar", "Unlimited games for ₹299", 260, 1.5, "entertainment games friends cafe", "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=900&q=88"],
  ["Music House Live", "Entertainment", "Fort Kochi", "Student gig tickets at 30% off", 350, 7.8, "entertainment music live event", "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=88"],
  ["Munnar Ride Co", "Travel", "Kochi", "Weekend cab package at 20% off", 1800, 2.0, "travel taxi munnar weekend", "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=88"],
  ["Alleppey Day Trips", "Travel", "Online", "Backwater day trip from ₹1,499", 1200, 0, "travel backwater tour online", "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=900&q=88"],
  ["Airport Buddy Kerala", "Travel", "Nedumbassery", "Student airport transfers at ₹699", 550, 25, "travel airport taxi transport", "https://images.unsplash.com/photo-1515569067071-ec3b51335dd0?auto=format&fit=crop&w=900&q=88"],
  ["Design Club Kerala", "Learn", "Online", "Free UI design starter class", 600, 0, "learn design course student", "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=88"],
  ["Excel in a Weekend", "Learn", "Kochi", "Two-day student bootcamp", 750, 2.1, "learn excel course workshop", "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=88"],
  ["Malayalam Creators Lab", "Learn", "Online", "First creator workshop free", 500, 0, "learn creator video course", "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=900&q=88"],
  ["Content & Social Intern", "Internships", "Kochi", "Paid · 3 months", 0, 1.8, "internship content social media student", "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=88"],
  ["Events Intern", "Internships", "Ernakulam", "Paid · Weekend friendly", 0, 1.4, "internship events campus student", "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=88"],
  ["Operations Intern", "Internships", "Kakkanad", "Paid · Hybrid", 0, 5.0, "internship operations business student", "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=88"],
  ["Reels Editor Briefs", "Freelance", "Remote", "Projects from ₹2,500", 0, 0, "freelance reels editor video", "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=900&q=88"],
  ["Student Design Gigs", "Freelance", "Remote", "Logos and posts from ₹1,500", 0, 0, "freelance design graphics student", "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=900&q=88"],
  ["Campus Photography", "Freelance", "Kerala colleges", "Event shoots from ₹3,000", 0, 0, "freelance photography campus events", "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=88"],
] as const;

const foodCategorySeeds = [
  ["Mains", "Paragon Restaurant", "Lulu Mall", "Up to 25% off mains", 480, 3.2, "mains biryani burgers pizza shawarma noodles pasta seafood steaks", "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=900&q=88"],
  ["Mains", "Salkara Restaurant", "Vyttila", "Student mains from ₹169", 320, 4.1, "mains biryani burgers pizza shawarma noodles pasta seafood steaks", "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=88"],
  ["Mains", "Ceylon Bake House", "MG Road", "Buy one main, get one 50% off", 390, 1.1, "mains biryani burgers pizza shawarma noodles pasta seafood steaks", "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=88"],
  ["Mains", "Malabar Junction", "Fort Kochi", "20% off your table", 550, 7.5, "mains biryani burgers pizza shawarma noodles pasta seafood steaks", "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=88"],
  ["Mains", "The Rice Boat", "Grand Hyatt Bolgatty", "Seafood mains at 20% off", 750, 2.8, "mains biryani burgers pizza shawarma noodles pasta seafood steaks", "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=88"],
  ["Mains", "Roastown Global Grill", "Edappally", "Student table offer, 15% off", 460, 3.7, "mains biryani burgers pizza shawarma noodles pasta seafood steaks", "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=88"],
  ["Snacks", "Chicking", "Marine Drive", "Snack combos from ₹99", 220, 1.0, "snacks fries wraps momos sandwiches wings tacos", "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=900&q=88"],
  ["Snacks", "KFC", "Centre Square Mall", "Second snack box free", 260, .8, "snacks fries wraps momos sandwiches wings tacos", "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=900&q=88"],
  ["Snacks", "Subway", "Panampilly Nagar", "20% off wraps and sandwiches", 180, 1.4, "snacks fries wraps momos sandwiches wings tacos", "https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=900&q=88"],
  ["Snacks", "Wow! Momo", "Lulu Mall", "Momo meals from ₹149", 210, 3.2, "snacks fries wraps momos sandwiches wings tacos", "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?auto=format&fit=crop&w=900&q=88"],
  ["Snacks", "McDonald's", "Lulu Mall", "Fries and wrap combos from ₹129", 200, 3.2, "snacks fries wraps momos sandwiches wings tacos", "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=88"],
  ["Snacks", "The Burger Junction", "Kakkanad", "Loaded snacks at 25% off", 240, 5.1, "snacks fries wraps momos sandwiches wings tacos", "https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=900&q=88"],
  ["Drinks", "Starbucks", "Panampilly Nagar", "Buy one drink, get one free", 320, 1.3, "drinks coffee tea boba juices shakes smoothies", "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=88"],
  ["Drinks", "Cafe Coffee Day", "MG Road", "Drinks from ₹99", 180, 1.0, "drinks coffee tea boba juices shakes smoothies", "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=900&q=88"],
  ["Drinks", "Chai Point", "Kakkanad", "Second chai free", 150, 5.0, "drinks coffee tea boba juices shakes smoothies", "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=88"],
  ["Drinks", "Drunken Monkey", "Edappally", "Smoothies at 25% off", 240, 3.4, "drinks coffee tea boba juices shakes smoothies", "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=900&q=88"],
  ["Drinks", "Costa Coffee", "Lulu Mall", "Buy one coffee, get one free", 280, 3.2, "drinks coffee tea boba juices shakes smoothies", "https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=900&q=88"],
  ["Drinks", "Beyond Coffee", "Palarivattom", "Cold drinks from ₹149", 190, 2.9, "drinks coffee tea boba juices shakes smoothies", "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=88"],
  ["Sweets", "Navya Bakes", "Kadavanthra", "Cakes and pastries, 20% off", 250, 1.7, "sweets cakes ice-cream pastries donuts waffles", "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=88"],
  ["Sweets", "KR Bakes", "Palarivattom", "Dessert box from ₹199", 210, 2.8, "sweets cakes ice-cream pastries donuts waffles", "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=88"],
  ["Sweets", "Pauls Creamery", "Panampilly Nagar", "Buy one scoop, get one free", 220, 1.5, "sweets cakes ice-cream pastries donuts waffles", "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=88"],
  ["Sweets", "Dunkin'", "Lulu Mall", "Donut box at 30% off", 280, 3.2, "sweets cakes ice-cream pastries donuts waffles", "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=88"],
  ["Sweets", "Milano Ice Cream", "Fort Kochi", "Two gelato scoops for ₹199", 230, 7.7, "sweets cakes ice-cream pastries donuts waffles", "https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&w=900&q=88"],
  ["Sweets", "Cocoa Tree", "MG Road", "Dessert and coffee, 20% off", 260, 1.0, "sweets cakes ice-cream pastries donuts waffles", "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=88"],
  ["Cuisines", "Nasi and Mee", "Kakkanad", "Asian mains at 20% off", 420, 5.2, "cuisines arabic chinese indian italian mexican thai japanese", "https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=900&q=88"],
  ["Cuisines", "Little Soi", "Panampilly Nagar", "Two-course meal from ₹599", 500, 1.4, "cuisines arabic chinese indian italian mexican thai japanese", "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=900&q=88"],
  ["Cuisines", "Punjab Grill", "Lulu Mall", "Indian dining, 25% off", 650, 3.2, "cuisines arabic chinese indian italian mexican thai japanese", "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=88"],
  ["Cuisines", "Zoka", "Kakkanad", "Japanese bowls from ₹349", 390, 5.1, "cuisines arabic chinese indian italian mexican thai japanese", "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=88"],
  ["Cuisines", "Thai Soul", "Grand Hyatt Bolgatty", "Thai set menu at 20% off", 720, 2.8, "cuisines arabic chinese indian italian mexican thai japanese", "https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=900&q=88"],
  ["Cuisines", "Ming's Wok", "Panampilly Nagar", "Asian meal for two from ₹699", 510, 1.5, "cuisines arabic chinese indian italian mexican thai japanese", "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=88"],
  ["Dietary", "Beyondburg", "Panampilly Nagar", "Vegan meals at 25% off", 360, 1.6, "dietary healthy salads vegan keto bowls", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=88"],
  ["Dietary", "The Salad Bistro", "Kakkanad", "Healthy bowls from ₹199", 300, 5.0, "dietary healthy salads vegan keto bowls", "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=88"],
  ["Dietary", "Green Spoon", "Kadavanthra", "Keto and vegan, 20% off", 340, 1.9, "dietary healthy salads vegan keto bowls", "https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&w=900&q=88"],
  ["Dietary", "Brunchilly", "Edappally", "Protein bowls from ₹229", 280, 3.6, "dietary healthy salads vegan keto bowls", "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=88"],
  ["Dietary", "Diet Cafe", "Kakkanad", "Healthy meals at 20% off", 300, 5.0, "dietary healthy salads vegan keto bowls", "https://images.unsplash.com/photo-1539136788836-5699e78bfc75?auto=format&fit=crop&w=900&q=88"],
  ["Dietary", "Earth Lounge", "Fort Kochi", "Vegan bowls from ₹249", 320, 7.5, "dietary healthy salads vegan keto bowls", "https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=900&q=88"],
  ["Breakfast", "French Toast", "Kacheripady", "Breakfast for two at ₹399", 300, 2.0, "breakfast omelettes pancakes toast bagels crepes", "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=88"],
  ["Breakfast", "Kashi Art Cafe", "Fort Kochi", "Brunch at 20% off", 420, 8.4, "breakfast omelettes pancakes toast bagels crepes", "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=900&q=88"],
  ["Breakfast", "Pandhal Cafe & Deli", "Kadavanthra", "Morning combo from ₹249", 260, 1.8, "breakfast omelettes pancakes toast bagels crepes", "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=88"],
  ["Breakfast", "Cafe 17", "Ravipuram", "Pancakes and coffee at ₹299", 240, 1.2, "breakfast omelettes pancakes toast bagels crepes", "https://images.unsplash.com/photo-1519671282429-b44660ead0a7?auto=format&fit=crop&w=900&q=88"],
  ["Breakfast", "Loafer's Corner Cafe", "Fort Kochi", "Breakfast favourites at 20% off", 270, 7.8, "breakfast omelettes pancakes toast bagels crepes", "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=88"],
  ["Breakfast", "David Hall Cafe", "Fort Kochi", "Breakfast for two from ₹449", 350, 7.6, "breakfast omelettes pancakes toast bagels crepes", "https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=900&q=88"],
  ["Buffet", "Kochi Kitchen", "Kochi Marriott", "Lunch buffet, 25% off", 900, 3.1, "buffet platters thalis banquets feasts unlimited", "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=88"],
  ["Buffet", "Latest Recipe", "Le Méridien Kochi", "Student buffet from ₹999", 1000, 6.2, "buffet platters thalis banquets feasts unlimited", "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=88"],
  ["Buffet", "Cassava", "Kochi Marriott", "Kerala feast, 20% off", 780, 3.1, "buffet platters thalis banquets feasts unlimited", "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=88"],
  ["Buffet", "Colony Clubhouse & Grill", "Grand Hyatt Bolgatty", "Unlimited brunch offer", 1200, 2.8, "buffet platters thalis banquets feasts unlimited", "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=88"],
  ["Buffet", "The Pavilion", "Crowne Plaza Kochi", "Dinner buffet at 25% off", 950, 6.0, "buffet platters thalis banquets feasts unlimited", "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=900&q=88"],
  ["Buffet", "Mosaic", "Crowne Plaza Kochi", "Weekend brunch from ₹1,099", 1100, 6.0, "buffet platters thalis banquets feasts unlimited", "https://images.unsplash.com/photo-1516211697506-8360dbcfe9a4?auto=format&fit=crop&w=900&q=88"],
] as const;

const normalizedFoodCategorySeeds = foodCategorySeeds.map(([category, name, place, tag, offer, distance, keywords, image]) => [name, category, place, tag, offer, distance, keywords, image] as const);

const allPlaceholderPartnerSeeds = [...placeholderPartnerSeeds, ...supplementalPartnerSeeds, ...normalizedFoodCategorySeeds] as const;

const placeholderPartners: DirectoryItem[] = allPlaceholderPartnerSeeds.map(([name, category, place, tag, offer, distance, keywords, image], index) => ({
  id: `partner-placeholder-${index + 1}`,
  type: category === "Learn" ? "Course" : category === "Internships" ? "Internship" : category === "Freelance" ? "Freelance" : "Vendor",
  title: name,
  subtitle: `${category} · ${place}`,
  tag,
  offer,
  newest: 30 - index,
  trend: 84 - (index % 9),
  distance,
  image,
  keywords: `${category} ${keywords} partner place offer Kerala`,
  description: `${name} is a sample Kouponly partner listing for ${category.toLowerCase()} discovery. Offer details, availability and redemption instructions are clearly shown before use.`,
  action: category === "Learn" ? "Open learning page" : category === "Internships" ? "View internship" : category === "Freelance" ? "View project" : "Redeem offer",
  externalUrl: category === "Learn" ? "https://www.coursera.org/search?query=career%20skills" : category === "Internships" ? "https://internshala.com/internships/internship-in-kochi/" : category === "Freelance" ? "https://www.upwork.com/nx/search/jobs/" : undefined,
  redemption: ["Shopping", "Travel"].includes(category) ? "online" : category === "Learn" || category === "Internships" || category === "Freelance" ? undefined : "inStore",
}));

const foodSubcategoryPartners: DirectoryItem[] = normalizedFoodCategorySeeds.flatMap(([name, category, place, baseTag, offer, distance, , image], vendorIndex) => {
  const details = categoryDetails[category as CategoryName];
  return details.subcategories.filter((subcategory) => subcategory.label !== "All").map((subcategory, subcategoryIndex) => ({
    id: `food-subcategory-${category.toLowerCase()}-${subcategory.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${vendorIndex}`,
    type: "Vendor" as const,
    title: name,
    subtitle: `${category} · ${subcategory.label} · ${place}`,
    tag: `${subcategory.label} offer · ${baseTag}`,
    offer,
    newest: 80 - subcategoryIndex - vendorIndex,
    trend: 96 - ((vendorIndex + subcategoryIndex * 2) % 11),
    distance,
    image,
    keywords: `${category} ${subcategory.label} ${subcategory.terms.join(" ")} partner food Kerala`,
    description: `${name} is featured for ${subcategory.label.toLowerCase()} in ${place}. Open the listing to view the member offer and redemption details.`,
    action: "Redeem offer",
    redemption: "inStore" as const,
  }));
});

const mapPartners: Deal[] = [
  ...deals,
  ...allPlaceholderPartnerSeeds
    .filter(([, category, place, , , distance]) => distance > 0 && !["Learn", "Internships", "Freelance"].includes(category) && place !== "Online")
    .map(([name, category, place, offer, offerValue, distance, , image], index) => ({
      id: 100 + index,
      name,
      place,
      category: category === "Things to do" ? "Activities" : category,
      distance: `${distance} km`,
      distanceKm: distance,
      rating: (4.5 + (index % 4) * 0.1).toFixed(1),
      offer,
      saving: offerValue ? `Save up to ₹${offerValue.toLocaleString("en-IN")}` : "Member offer",
      offerValue,
      newest: 30 - index,
      trend: 84 - (index % 8),
      image,
      color: "#f1f1ee",
      description: `${name} is a sample Kouponly partner in ${place}. Check the offer and redemption details before visiting.`,
    })),
];

const jobPlaceholderItems: DirectoryItem[] = [
  { id: "job-cafe-crew", type: "Job", title: "Part-time cafe crew", subtitle: "Panampilly Nagar · Evenings", tag: "From ₹180/hr", offer: 0, newest: 29, trend: 88, distance: 1.5, image: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=900&q=88", keywords: "job part time cafe student work", description: "A student-friendly evening role supporting service, orders and the daily cafe close.", action: "View role", externalUrl: "https://www.linkedin.com/jobs/search/?keywords=part%20time%20cafe&location=Kochi" },
  { id: "job-event-crew", type: "Job", title: "Weekend event crew", subtitle: "Ernakulam · Flexible shifts", tag: "₹1,200 per day", offer: 0, newest: 28, trend: 91, distance: 1.2, image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=88", keywords: "job events weekend student crew", description: "Help set up, welcome guests and keep local weekend events running smoothly.", action: "View role", externalUrl: "https://www.linkedin.com/jobs/search/?keywords=event%20crew&location=Kochi" },
  { id: "job-community-moderator", type: "Job", title: "Community moderator", subtitle: "Remote · Part-time", tag: "₹12,000/month", offer: 0, newest: 27, trend: 86, distance: 0, image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=88", keywords: "job remote community social media student", description: "Support an online community, answer common questions and flag conversations that need help.", action: "View role", externalUrl: "https://www.linkedin.com/jobs/search/?keywords=community%20moderator&location=Kerala" },
  { id: "job-customer-success", type: "Job", title: "Customer success trainee", subtitle: "Kakkanad · Hybrid", tag: "Entry level · Paid", offer: 0, newest: 26, trend: 90, distance: 5.0, image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=88", keywords: "job customer success entry level graduate", description: "Learn customer support and account coordination with coaching from an experienced team.", action: "View role", externalUrl: "https://www.linkedin.com/jobs/search/?keywords=customer%20success%20trainee&location=Kochi" },
  { id: "job-retail-associate", type: "Job", title: "Weekend retail associate", subtitle: "Edappally · Fri–Sun", tag: "₹9,000/month", offer: 0, newest: 25, trend: 84, distance: 3.4, image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=88", keywords: "job retail weekend student shopping", description: "A weekend store role helping customers, arranging displays and supporting checkout.", action: "View role", externalUrl: "https://www.linkedin.com/jobs/search/?keywords=retail%20associate&location=Kochi" },
];

const directoryItems: DirectoryItem[] = [
  ...deals.map((deal) => ({ id: `partner-${deal.id}`, type: "Vendor" as const, title: deal.name, subtitle: `${deal.category} · ${deal.place}`, tag: deal.saving, offer: deal.offerValue, newest: deal.newest, trend: deal.trend, distance: deal.distanceKm, image: deal.image, logo: deal.logo, dealId: deal.id, keywords: `${deal.category} offer brand partner place Kochi`, description: deal.description, action: "View offers" })),
  ...placeholderPartners,
  ...deals.slice(0, 6).map((deal) => ({ id: `offer-${deal.id}`, type: "Offer" as const, title: deal.offer, subtitle: `${deal.name} · ${deal.place}`, tag: deal.saving, offer: deal.offerValue, newest: deal.newest + 2, trend: deal.trend - 2, distance: deal.distanceKm, image: deal.image, dealId: deal.id, keywords: `${deal.category} deal discount save`, description: deal.description, action: "Unlock offer" })),
  { id: "backwater-cruise", type: "Experience", title: "Kumbalangi backwater sunset", subtitle: "3 hours · Guided village cruise", tag: "From ₹1,299", offer: 700, newest: 18, trend: 97, distance: 12, image: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=900&q=90", keywords: "experience activity backwater Kerala outdoor weekend", description: "A slow sunset cruise through Kumbalangi's backwaters with a local guide and tea.", action: "Redeem online", externalUrl: "https://www.keralatourism.org/" },
  { id: "pool-day", type: "Experience", title: "Bolgatty pool day", subtitle: "Day pass · Lunch included", tag: "From ₹1,499", offer: 800, newest: 17, trend: 92, distance: 2.8, image: "https://images.unsplash.com/photo-1573843981267-be1999ff37cd?auto=format&fit=crop&w=900&q=90", keywords: "experience pool staycation hotel Kochi weekend", description: "A sunny city escape with pool access, lunch and no overnight bag required.", action: "Redeem online", externalUrl: "https://www.hyatt.com/grand-hyatt/en-US/cokgh-grand-hyatt-kochi-bolgatty" },
  { id: "kayak", type: "Experience", title: "Kadamakkudy kayak morning", subtitle: "2 hours · Beginner friendly", tag: "From ₹899", offer: 400, newest: 16, trend: 89, distance: 11, image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=900&q=90", keywords: "experience kayaking water outdoor Kerala activity", description: "A calm guided paddle past small islands and fishing villages with all equipment included.", action: "Redeem online", externalUrl: "https://www.keralatourism.org/" },
  { id: "pottery", type: "Experience", title: "Make your own pottery cup", subtitle: "Mattancherry · 90 minutes", tag: "₹1,200", offer: 300, newest: 19, trend: 88, distance: 7.2, image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=90", keywords: "experience art pottery creative class Kerala", description: "A playful beginner workshop where you shape, decorate and keep your own ceramic cup.", action: "Redeem online", externalUrl: "https://www.keralatourism.org/" },
  { id: "portfolio", type: "Course", title: "Build your first portfolio", subtitle: "Coursera · Online", tag: "Free to audit", offer: 100, newest: 15, trend: 91, distance: 0, image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=90", keywords: "learn course design skills education", description: "A practical course that turns your work into a simple portfolio you can share.", action: "Open Coursera", externalUrl: "https://www.coursera.org/search?query=portfolio" },
  { id: "money-basics", type: "Course", title: "Money basics for your first salary", subtitle: "Khan Academy · Online", tag: "Free", offer: 100, newest: 14, trend: 86, distance: 0, image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=900&q=90", keywords: "learn course money finance skills", description: "Build a simple spending plan, understand saving and make your first salary go further.", action: "Open Khan Academy", externalUrl: "https://www.khanacademy.org/college-careers-more/personal-finance" },
  { id: "product-intern", type: "Internship", title: "Junior product design intern", subtitle: "LinkedIn Jobs · Kochi", tag: "Paid · 3 months", offer: 0, newest: 22, trend: 94, distance: 2.1, image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=90", keywords: "internship job work design opportunity", description: "Join a product team, learn through real projects and build work for your portfolio.", action: "Open LinkedIn", externalUrl: "https://www.linkedin.com/jobs/search/?keywords=product%20design%20intern&location=Kochi" },
  { id: "marketing-intern", type: "Internship", title: "Marketing internship at Kouponly", subtitle: "Kochi · Paid · Hybrid", tag: "Show interest", offer: 0, newest: 25, trend: 95, distance: 1.1, image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=90", keywords: "internship job marketing Kouponly work with us", description: "Learn campaigns, community growth and content execution with the Kouponly team.", action: "Show interest", destination: "work" },
  { id: "bd-intern", type: "Internship", title: "BD & sales internship at Kouponly", subtitle: "Kochi · Paid · Field + office", tag: "Show interest", offer: 0, newest: 26, trend: 96, distance: 1.1, image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=90", keywords: "internship business development sales Kouponly work with us", description: "Help discover local brands, start conversations and learn how partnerships are built.", action: "Show interest", destination: "work" },
  { id: "campus-ambassador", type: "Internship", title: "Kouponly Campus Ambassador", subtitle: "Kerala universities · Flexible", tag: "Gold Card benefits", offer: 0, newest: 28, trend: 99, distance: 0, image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=900&q=90", keywords: "student campus ambassador university college Kouponly gold card freebies", description: "Bring Kouponly into campus events and student communities, then earn Gold Card access to selected free food and experiences.", action: "Apply to represent campus", destination: "work" },
  { id: "ugc-creator", type: "Freelance", title: "Become a Kouponly UGC creator", subtitle: "Campaign-based · Paid per brief", tag: "3 campaigns open", offer: 0, newest: 27, trend: 98, distance: 0, image: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=900&q=90", keywords: "ugc creator freelance campaigns video Kouponly work with us", description: "Choose brand campaigns, create short videos and get paid after approval and delivery.", action: "View campaigns", destination: "work" },
  { id: "social-video", type: "Freelance", title: "Shoot 5 social videos", subtitle: "Upwork · Remote", tag: "Earn ₹6,000", offer: 0, newest: 23, trend: 87, distance: 0, image: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=900&q=90", keywords: "freelance creator video work gig earn", description: "Create five short vertical videos from a clear brief for a growing local food brand.", action: "Open Upwork", externalUrl: "https://www.upwork.com/nx/search/jobs/?q=UGC%20creator" },
  { id: "community-host", type: "Job", title: "Weekend community host", subtitle: "LinkedIn Jobs · Marine Drive", tag: "Part-time · ₹350/hr", offer: 0, newest: 20, trend: 83, distance: 1.1, image: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=900&q=90", keywords: "job part time events host opportunity work Kochi", description: "Welcome guests, support weekend events and help create a warm community experience.", action: "Open LinkedIn", externalUrl: "https://www.linkedin.com/jobs/search/?keywords=part%20time&location=Kochi" },
  ...jobPlaceholderItems,
  { id: "reward-coffee", type: "Prize", title: "Redeem a free coffee", subtitle: "Fixed reward · Participating cafes", tag: "200 points", offer: 0, newest: 21, trend: 93, distance: 0, image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=90", keywords: "reward points challenge coffee free redeem", description: "Exchange 200 points for one regular coffee. This is a guaranteed reward, not a prize draw.", action: "Redeem points", destination: "rewards" },
  { id: "reward-experience", type: "Prize", title: "Redeem a pottery workshop", subtitle: "Fixed reward · Mattancherry", tag: "650 points", offer: 0, newest: 12, trend: 88, distance: 7.2, image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=90", keywords: "reward points challenge experience pottery free redeem", description: "Exchange 650 points for a beginner pottery session. No cash alternative and no random draw.", action: "Redeem points", destination: "rewards" },
];

const heroSlides = [
  { brand: "Paragon Restaurant", logo: "https://www.google.com/s2/favicons?domain=paragonrestaurant.in&sz=128", kicker: "BIRYANI, DOUBLED", title: "Two plates. One happy bill.", copy: "Bring your favourite person and save up to ₹480.", cta: "See the offer", image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=900&q=90" },
  { brand: "Starbucks", logo: "https://cdn.simpleicons.org/starbucks/00754A", kicker: "COFFEE RUN", title: "Your second cup is on us.", copy: "Any two handcrafted drinks, one member price.", cta: "Pick a drink", image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=90" },
  { brand: "KFC", logo: "https://cdn.simpleicons.org/kfc/F40027", kicker: "CRUNCH TIME", title: "Two combos. Better value.", copy: "Share two Zinger combos for ₹499 this week.", cta: "Get the deal", image: "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=900&q=90" },
  { brand: "Burger King", logo: "https://cdn.simpleicons.org/burgerking/D62300", kicker: "BURGER DATE", title: "Double the Whopper. Less of the bill.", copy: "Buy one Whopper and get one free.", cta: "See the menu", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=90" },
  { brand: "Kochi Marriott", logo: "https://cdn.simpleicons.org/marriott/8B1D41", kicker: "POOL DAY", title: "A tiny holiday, right here.", copy: "Pool access and lunch for two at a member price.", cta: "Take a day off", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=90" },
  { brand: "Nykaa Luxe", logo: "https://www.google.com/s2/favicons?domain=nykaa.com&sz=128", kicker: "BEAUTY DROP", title: "Good skin. Better price.", copy: "Fresh beauty offers from the brands you love.", cta: "Shop the edit", image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=90" },
  { brand: "Decathlon", logo: "https://www.google.com/s2/favicons?domain=decathlon.in&sz=128", kicker: "MOVE MORE", title: "Try a new sport for less.", copy: "Selected gear and beginner picks for members.", cta: "Get moving", image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=90" },
  { brand: "PVR Cinemas", logo: "https://www.google.com/s2/favicons?domain=pvrcinemas.com&sz=128", kicker: "MOVIE NIGHT", title: "Big screen. Smaller bill.", copy: "Two premium seats from ₹499.", cta: "Choose a movie", image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=90" },
  { brand: "Wonderla Kochi", logo: "https://www.google.com/s2/favicons?domain=wonderla.com&sz=128", kicker: "FULL DAY FUN", title: "More rides. Less waiting to plan.", copy: "Member prices for your next group day out.", cta: "Plan the day", image: "https://images.unsplash.com/photo-1576610616656-d3aa5d1f4534?auto=format&fit=crop&w=900&q=90" },
  { brand: "IndiGo", logo: "https://www.google.com/s2/favicons?domain=goindigo.in&sz=128", kicker: "NEXT ESCAPE", title: "Your weekend could be elsewhere.", copy: "Short-break fares and extras from Kochi.", cta: "Start exploring", image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=90" },
];

const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "explore", label: "Home", icon: Home },
  { id: "search", label: "Search", icon: Search },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "profile", label: "Me", icon: UserRound },
];

function dialogForMessage(message: string): UtilityDialogData | null {
  const lower = message.toLowerCase();
  if (message === "You’re all caught up") return { eyebrow: "NOTIFICATIONS", title: "Nothing needs your attention", body: "New Kerala offers land every week. Creator updates, reward progress and redemption reminders will appear here.", details: ["Offer alerts are on", "Creator updates are on", "No expiring codes today"] };
  if (lower.includes("support") || lower.includes("calling kouponly")) return { eyebrow: "HELP & SUPPORT", title: "Talk to a real person", body: "The Kouponly team is available every day from 9am to 8pm for account, redemption and creator questions.", details: ["Phone: +91 484 400 2400", "Email: hello@kouponly.com", "Typical chat reply: under 5 minutes"], primaryLabel: "Email support", primaryHref: "mailto:hello@kouponly.com" };
  if (lower.includes("campaign payment") || lower.includes("campaign payout")) return { eyebrow: "PAYMENT DETAIL", title: message.replace(/ opened$/i, ""), body: "This payout is linked to an approved creator brief. Its status, delivery date and bank reference are recorded below.", details: ["Content approved", "Usage rights received", "Bank transfer tracked in Creator earnings"] };
  if (lower.includes("redemption details")) return { eyebrow: "SAVING DETAIL", title: message.replace(/ details opened$/i, ""), body: "This in-store redemption was verified with the partner PIN and added to your monthly savings.", details: ["Status: completed", "Renewal: 1 September", "Receipt available from the partner"] };
  if (lower.includes("campus ambassador")) return { eyebrow: "GOLD CARD PATH", title: "Campus Ambassador eligibility", body: "Current Kerala university students can apply. Selected ambassadors bring Kouponly into campus activities, share feedback and help students discover member benefits.", details: ["Active student ID required", "One campus event or activation each month", "Gold Card unlocks after selection"] };
  if (lower.includes("gift link") || lower.includes("choose an offer to gift")) return { eyebrow: "KOUPONLY GIFTS", title: "Send an offer, not a screenshot", body: "Choose a saved offer, add the recipient’s mobile number and Kouponly will create a claim link. The redemption remains protected by partner verification.", details: ["The recipient sees the expiry before accepting", "Unused gifts can be cancelled", "No payment details are shared"] };
  if (lower.includes("profile form")) return { eyebrow: "PERSONAL DETAILS", title: "Your profile is ready to edit", body: "Update your name, mobile number and home city from the form on this page. Changes are saved only after confirmation." };
  if (lower.includes("appearance")) return { eyebrow: "APPEARANCE", title: "Light mode is active", body: "Kouponly currently uses one high-contrast light theme across every screen for consistent readability.", details: ["System font scaling supported", "Reduced motion respected", "Dark mode is planned"] };
  if (lower.includes("terms of use")) return { eyebrow: "LEGAL", title: "Terms of use", body: "Offers are subject to the eligibility, redemption limits and renewal dates shown before confirmation. Partners verify in-store use with their private PIN.", details: ["One account per member", "Three uses per recurring offer unless stated otherwise", "Expired codes cannot be restored"] };
  if (lower.includes("privacy policy")) return { eyebrow: "LEGAL", title: "Privacy policy", body: "Kouponly uses only the information needed to run your account, personalise Kerala discovery and verify redemptions.", details: ["Marketing preferences are optional", "Location is used only when requested", "Account deletion requests are supported"] };
  if (lower.includes("creator terms")) return { eyebrow: "CREATOR TERMS", title: "Campaign delivery and payment", body: "Each brief defines deliverables, review rounds, posting requirements, usage rights and pay before you apply.", details: ["No work starts before selection", "One reasonable review round", "Payment follows approval and posting"] };
  if (lower.includes("how does in-store")) return { eyebrow: "REDEMPTION HELP", title: "How in-store redemption works", body: "Open the offer only when you are at the counter. A staff member checks availability and enters the partner’s four-digit PIN on your phone.", details: ["Never ask a partner to share their PIN", "A successful verification uses one redemption", "The activity appears in Savings history"] };
  if (lower.includes("online offer code")) return { eyebrow: "REDEMPTION HELP", title: "Finding your online code", body: "After you confirm an online redemption, the code appears for ten minutes with a direct button to the partner website.", details: ["Copy the code before checkout", "Use it only on eligible items", "Revealing it consumes one redemption"] };
  if (lower.includes("creator payments work")) return { eyebrow: "CREATOR HELP", title: "How creator payments work", body: "Payment begins after the brand approves your final file and any required post is live.", details: ["Approved work moves to processing", "The expected date appears in Creator earnings", "Bank transfer references remain in activity"] };
  if (lower.includes("gold card include")) return { eyebrow: "MEMBERSHIP HELP", title: "What the Gold Card includes", body: "Selected campus ambassadors unlock rotating freebies and experiences at participating Kerala partners.", details: ["Free items are clearly marked", "Partner-specific limits still apply", "Benefits stay visible in Membership"] };
  if (lower.includes("offer activity") || lower.includes("profile checklist") || lower.includes("category challenge")) return { eyebrow: "CHALLENGE DETAIL", title: message.replace(/ opened$/i, ""), body: "Progress updates automatically after eligible activity. Completed challenges add points to your balance; points can only be exchanged for listed rewards.", details: ["No cash prizes", "No chance-based entries", "Progress is visible in Challenges & rewards"] };
  if (lower.startsWith("choose a reward")) return { eyebrow: "REWARD REDEMPTION", title: "How points redemption works", body: "Choose an available reward, review the point cost and confirm only when the item is available. The partner then enters their private four-digit PIN.", details: ["Points deduct only after verification", "Redeemed rewards appear in activity", "Rewards cannot be exchanged for cash"] };
  if (lower.includes("demo mode")) return { eyebrow: "DEMO ACCOUNT", title: "Sign-out is protected in this preview", body: "This concept keeps the demo profile available so every feature can be tested without creating an account.", details: ["No real personal data is stored", "Saved items reset with the preview", "Production sign-out will end the secure session"] };
  if (lower.endsWith(" opened")) return { eyebrow: "DETAILS", title: message.replace(/ opened$/i, ""), body: "This item now has a defined destination in the Kouponly prototype. The information shown here is the preview of its full production flow." };
  return null;
}

export default function HomePage() {
  const [theme, setTheme] = useState<"light" | "dark">(() => typeof window !== "undefined" && window.localStorage.getItem("kouponly-theme") === "dark" ? "dark" : "light");
  const [activeTab, setActiveTab] = useState<Tab>("explore");
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [selectedListing, setSelectedListing] = useState<DirectoryItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryName | null>(null);
  const [workOpen, setWorkOpen] = useState(false);
  const [workTrack, setWorkTrack] = useState<WorkTrack>("creator");
  const [accountPage, setAccountPage] = useState<AccountPageKey | null>(null);
  const [appliedCampaigns, setAppliedCampaigns] = useState<Set<string>>(() => new Set());
  const [saved, setSaved] = useState<Set<number>>(() => new Set([2]));
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("All");
  const [searchSort, setSearchSort] = useState<SearchSort>("Trending");
  const [toast, setToast] = useState("");
  const [utilityDialog, setUtilityDialog] = useState<UtilityDialogData | null>(null);
  const [profileRewardsOpen, setProfileRewardsOpen] = useState(false);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const changeTheme = (nextTheme: "light" | "dark") => {
    setTheme(nextTheme);
    window.localStorage.setItem("kouponly-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  };

  useEffect(() => {
    document.getElementById("app-scroll")?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeTab, selectedDeal, selectedListing, selectedCategory, accountPage, workOpen]);

  const notify = (message: string) => {
    const dialog = dialogForMessage(message);
    if (dialog) {
      setUtilityDialog(dialog);
      return;
    }
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const toggleSaved = (id: number) => {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        notify("Removed from saved");
      } else {
        next.add(id);
        notify("Saved for later");
      }
      return next;
    });
  };

  const changeTab = (tab: Tab) => {
    setSelectedDeal(null);
    setSelectedListing(null);
    setSelectedCategory(null);
    setWorkOpen(false);
    setAccountPage(null);
    setActiveTab(tab);
  };

  const openSearch = (term = "") => {
    setSearchQuery(term);
    setSearchFilter("All");
    setSearchSort("Trending");
    changeTab("search");
  };

  const openCategory = (category: CategoryName) => {
    setSelectedCategory(category);
    setSelectedDeal(null);
    setSelectedListing(null);
    setAccountPage(null);
    setWorkOpen(false);
  };

  const openDirectoryItem = (item: DirectoryItem) => {
    if (item.destination === "rewards") {
      setProfileRewardsOpen(true);
      changeTab("profile");
      return;
    }
    if (item.destination === "work") {
      setWorkTrack(item.id === "campus-ambassador" ? "campus" : item.id === "bd-intern" ? "bd" : item.id === "marketing-intern" ? "marketing" : "creator");
      setWorkOpen(true);
      return;
    }
    const linkedDeal = typeof item.dealId === "number" ? deals.find((deal) => deal.id === item.dealId) : undefined;
    if (linkedDeal) setSelectedDeal(linkedDeal);
    else setSelectedListing(item);
  };

  const toggleCampaign = (campaignId: string) => {
    setAppliedCampaigns((current) => {
      const next = new Set(current);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

  return (
    <main className="site-stage" data-theme={theme}>
      <aside className="brand-panel" aria-label="Kouponly brand introduction">
        <div className="brand-mark"><span>K</span></div>
        <p className="eyebrow">LIGHT MODE CONCEPT</p>
        <h1>Good plans.<br /><em>Better prices.</em></h1>
        <p className="brand-copy">A friendly, premium savings app built around discovery — not discount clutter.</p>
        <div className="palette" aria-label="Brand palette">
          <span className="swatch coral" /><span className="swatch ink" /><span className="swatch teal" /><span className="swatch cream" />
        </div>
        <div className="brand-note"><Sparkles size={18} /><span>Made for Kerala<br /><b>Save without settling.</b></span></div>
      </aside>

      <section className="app-shell" aria-label="Kouponly mobile application">
        <div className="status-bar" aria-hidden="true"><b>9:41</b><span>●●● ︵ 87%</span></div>
        <div className="app-scroll" id="app-scroll">
          {selectedDeal ? (
            <DealDetail deal={selectedDeal} saved={saved.has(selectedDeal.id)} onBack={() => setSelectedDeal(null)} onSave={() => toggleSaved(selectedDeal.id)} notify={notify} />
          ) : selectedListing ? (
            <ListingDetail item={selectedListing} onBack={() => setSelectedListing(null)} notify={notify} />
          ) : accountPage ? (
            <AccountPage page={accountPage} onBack={() => setAccountPage(null)} notify={notify} theme={theme} onThemeChange={changeTheme} />
          ) : workOpen ? (
            <WorkWithUs initialTrack={workTrack} onBack={() => setWorkOpen(false)} onEarnings={() => setAccountPage("earnings")} notify={notify} appliedCampaigns={appliedCampaigns} onToggleCampaign={toggleCampaign} />
          ) : selectedCategory ? (
            <CategoryView category={selectedCategory} onBack={() => setSelectedCategory(null)} onOpen={openDirectoryItem} />
          ) : (
            <>
              {activeTab === "explore" && <Explore saved={saved} onSelect={setSelectedDeal} onSave={toggleSaved} onTab={changeTab} onSearch={openSearch} onCategory={openCategory} onWork={(track = "creator") => { setWorkTrack(track); setWorkOpen(true); }} onAccount={setAccountPage} onRewards={() => { setProfileRewardsOpen(true); changeTab("profile"); }} notify={notify} />}
              {activeTab === "saved" && <Saved saved={saved} onSelect={setSelectedDeal} onSave={toggleSaved} notify={notify} />}
              {activeTab === "search" && <SearchView query={searchQuery} setQuery={setSearchQuery} filter={searchFilter} setFilter={setSearchFilter} sortBy={searchSort} setSortBy={setSearchSort} onOpen={openDirectoryItem} />}
              {activeTab === "map" && <MapView onSelect={setSelectedDeal} notify={notify} />}
              {activeTab === "profile" && <Profile notify={notify} appliedCampaigns={appliedCampaigns} onCreatorHub={() => { setWorkTrack("creator"); setWorkOpen(true); }} onAccount={setAccountPage} onBrowseDeals={() => openSearch("discount")} openRewards={profileRewardsOpen} onRewardsOpened={() => setProfileRewardsOpen(false)} />}
            </>
          )}
        </div>

        {!selectedDeal && !selectedListing && !selectedCategory && !accountPage && !workOpen && (
          <nav className="bottom-nav" aria-label="Primary navigation">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} className={activeTab === id ? "active" : ""} onClick={() => changeTab(id)} aria-current={activeTab === id ? "page" : undefined}>
                <Icon size={22} strokeWidth={activeTab === id ? 2.6 : 2} /><span>{label}</span>
              </button>
            ))}
          </nav>
        )}
        {toast && <div className="toast"><Check size={16} />{toast}</div>}
        {utilityDialog && <UtilityDialog data={utilityDialog} onClose={() => setUtilityDialog(null)} />}
      </section>
    </main>
  );
}

function Explore({ saved, onSelect, onSave, onTab, onSearch, onCategory, onWork, onAccount, onRewards, notify }: { saved: Set<number>; onSelect: (deal: Deal) => void; onSave: (id: number) => void; onTab: (tab: Tab) => void; onSearch: (term?: string) => void; onCategory: (category: CategoryName) => void; onWork: (track?: WorkTrack) => void; onAccount: (page: AccountPageKey) => void; onRewards: () => void; notify: (message: string) => void }) {
  const visibleDeals = deals;
  const [heroIndex, setHeroIndex] = useState(0);
  const [homeMode, setHomeMode] = useState<"save" | "play" | "grow">("save");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pathsOpen, setPathsOpen] = useState(false);
  const activeHero = heroSlides[heroIndex];
  useEffect(() => {
    const timer = window.setInterval(() => setHeroIndex((current) => (current + 1) % heroSlides.length), 5000);
    return () => window.clearInterval(timer);
  }, []);
  const cityStories = [
    { title: "Bolgatty pool day", note: "Pool and lunch from ₹1,499", query: "Bolgatty pool day", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=88" },
    { title: "Kumbalangi sunset", note: "A slow backwater evening", query: "Kumbalangi", image: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=600&q=88" },
    { title: "Pottery in Mattancherry", note: "Make something worth keeping", query: "pottery", image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=600&q=88" },
  ];
  const modeCategories = homeMode === "save" ? categories.slice(0, 8) : homeMode === "play" ? [categories[10], categories[11], categories[13], categories[14]] : [categories[15], categories[16], categories[17], { name: "Jobs", search: "job", icon: BriefcaseBusiness, image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=500&q=88" }];
  const kouponlyPaths: { title: string; note: string; track: WorkTrack; icon: typeof Clapperboard }[] = [
    { title: "UGC Creator", note: "Paid brand campaigns", track: "creator", icon: Clapperboard },
    { title: "BD & Sales", note: "Paid internship", track: "bd", icon: BriefcaseBusiness },
    { title: "Marketing", note: "Paid internship", track: "marketing", icon: Sparkles },
    { title: "Campus", note: "Ambassador + Gold Card", track: "campus", icon: GraduationCap },
  ];
  const opportunities = [
    { type: "LEARN", title: "Build your first portfolio", meta: "Free · 35 min", icon: GraduationCap },
    { type: "INTERNSHIP", title: "Junior product design intern", meta: "Kochi · Paid · 3 months", icon: BriefcaseBusiness },
    { type: "FREELANCE", title: "Shoot 5 social videos", meta: "Remote · ₹6,000", icon: Laptop },
    { type: "PART-TIME", title: "Weekend community host", meta: "Marine Drive · ₹350/hr", icon: Rocket },
  ];
  return (
    <div className="screen explore-screen">
      <header className="home-header">
        <div className="home-identity"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open account menu"><Menu size={21} /></button><div><p className="micro">Hey Neil</p><h2>What’s the plan?</h2></div></div>
        <div className="header-actions">
          <button className="round-btn" aria-label="Notifications" onClick={() => notify("You’re all caught up")}><Bell size={20} /><i /></button>
        </div>
      </header>

      {menuOpen && <div className="menu-overlay" role="dialog" aria-modal="true" aria-label="Account menu">
        <button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close account menu" />
        <aside className="account-drawer">
          <div className="drawer-profile"><span>N</span><div><b>Neil Jose Pillard</b><small>Kochi, Kerala</small></div><button onClick={() => setMenuOpen(false)} aria-label="Close account menu"><X size={18} /></button></div>
          <button className="drawer-savings" onClick={() => { setMenuOpen(false); onAccount("savings"); }}><span><small>TOTAL SAVED</small><b>₹2,400</b></span><span><small>TOTAL EARNED</small><b>₹8,750</b></span><span><small>REWARDS</small><b>680 pts</b></span><ChevronRight size={18} /></button>
          <nav>
            <button onClick={() => { setMenuOpen(false); onAccount("savings"); }}><BadgePercent size={20} /><span><b>Savings history</b><small>See every saving and redemption</small></span><ChevronRight size={17} /></button>
            <button onClick={() => { setMenuOpen(false); onAccount("earnings"); }}><WalletCards size={20} /><span><b>Creator earnings</b><small>Paid UGC work and pending payouts</small></span><ChevronRight size={17} /></button>
            <button onClick={() => { setMenuOpen(false); onTab("saved"); }}><Heart size={20} /><span><b>Saved offers</b><small>Your places and discounts</small></span><ChevronRight size={17} /></button>
            <button onClick={() => { setMenuOpen(false); onSearch("partner"); }}><Store size={20} /><span><b>Explore partners</b><small>Browse every Kouponly place</small></span><ChevronRight size={17} /></button>
            <button onClick={() => { setMenuOpen(false); onTab("map"); }}><MapPin size={20} /><span><b>Map near me</b><small>Find offers around Kochi</small></span><ChevronRight size={17} /></button>
            <button onClick={() => { setMenuOpen(false); onWork(); }}><Rocket size={20} /><span><b>Work with Kouponly</b><small>Creator, internship and campus roles</small></span><ChevronRight size={17} /></button>
            <button onClick={() => { setMenuOpen(false); onAccount("help"); }}><MessageCircle size={20} /><span><b>Help & support</b><small>Chat, call or read FAQs</small></span><ChevronRight size={17} /></button>
            <button onClick={() => { setMenuOpen(false); onAccount("settings"); }}><Settings size={20} /><span><b>Settings</b><small>Profile, language and preferences</small></span><ChevronRight size={17} /></button>
          </nav>
          <div className="drawer-links"><button onClick={() => { setMenuOpen(false); onAccount("feedback"); }}>Feedback</button><button onClick={() => { setMenuOpen(false); onAccount("help"); }}>FAQ</button><button onClick={() => { setMenuOpen(false); onAccount("legal"); }}>Terms & privacy</button></div>
          <button className="support-call" onClick={() => { setMenuOpen(false); notify("Calling Kouponly support…"); }}><Phone size={19} /> Call support</button>
        </aside>
      </div>}

      <button className="search-entry" onClick={() => onTab("search")}><Search size={19} /><span>Search deals, events, skills or jobs</span><SlidersHorizontal size={18} /></button>

      <section className="mode-picker" aria-label="Choose what you want to do">
        <p>Today I want to…</p>
        <div>
          <button className={homeMode === "save" ? "active" : ""} onClick={() => { setHomeMode("save"); setPathsOpen(false); }}><WalletCards size={18} /><span><b>Save</b><small>Deals & offers</small></span></button>
          <button className={homeMode === "play" ? "active" : ""} onClick={() => { setHomeMode("play"); setPathsOpen(false); }}><Sparkles size={18} /><span><b>Go out</b><small>Book & explore</small></span></button>
          <button className={homeMode === "grow" ? "active" : ""} onClick={() => setHomeMode("grow")}><Rocket size={18} /><span><b>Grow</b><small>Learn & earn</small></span></button>
        </div>
      </section>

      {homeMode === "save" && <section className="hero-card rotating-hero" aria-roledescription="carousel" aria-label="Featured brand offers">
        <div className="hero-copy" key={activeHero.brand}>
          <div className="hero-brand"><span className="hero-logo"><img src={activeHero.logo} alt={`${activeHero.brand} logo`} /></span><span className="hero-kicker">{activeHero.kicker}</span></div>
          <h3>{activeHero.title}</h3><p>{activeHero.copy}</p>
          <button onClick={() => onSelect(deals.find((deal) => deal.name.toLowerCase().replace(/['’]/g, "") === activeHero.brand.toLowerCase().replace(/['’]/g, "")) ?? deals[6])}>{activeHero.cta} <ArrowRight size={17} /></button>
        </div>
        <div className="hero-photo" key={activeHero.image}><img src={activeHero.image} alt={`${activeHero.brand} featured offer`} /></div>
        <div className="hero-pagination" aria-label="Choose featured offer">{heroSlides.map((slide, index) => <button key={slide.brand} className={index === heroIndex ? "active" : ""} onClick={() => setHeroIndex(index)} aria-label={`Show ${slide.brand} offer`} aria-current={index === heroIndex ? "true" : undefined} />)}</div>
      </section>}

      {homeMode === "play" && <section className="mode-hero play-hero"><div><span>WEEKEND MODE</span><h3>Your next story starts outside.</h3><p>Book something fun in under a minute.</p><button onClick={() => onSearch("experience")}>Find an experience <ArrowRight size={17} /></button></div><img src="https://images.unsplash.com/photo-1519671282429-b44660ead0a7?auto=format&fit=crop&w=700&q=88" alt="Friends enjoying an outdoor experience" /></section>}

      {homeMode === "grow" && <><section className="mode-hero grow-hero grow-hero-combined">
        <div className="grow-hero-intro"><span>WORK WITH KOUPONLY</span><h3>Your talent. Real briefs. Real experience.</h3><p>Join paid creator campaigns, internships or lead Kouponly on your campus.</p><button onClick={() => setPathsOpen((current) => !current)} aria-expanded={pathsOpen}>{pathsOpen ? "Hide paths" : "See open paths"} <ArrowRight size={17} /></button></div>
        <div className="grow-orbit"><Clapperboard size={31} /><BriefcaseBusiness size={24} /><GraduationCap size={22} /></div>
      </section>
      {pathsOpen && <section className="grow-path-reveal" aria-label="Kouponly career paths"><div className="grow-path-reveal-head"><div className="grow-inline-heading"><span>START WITH US</span><b>Pick your Kouponly path</b><small>Built for students and early-career talent in Kerala.</small></div><button onClick={() => setPathsOpen(false)} aria-label="Close Kouponly paths"><X size={17} /></button></div><div className="grow-inline-grid">{kouponlyPaths.map(({ title, note, track, icon: Icon }) => <button key={track} onClick={() => onWork(track)}><span><Icon size={17} /></span><div><b>{title}</b><small>{note}</small></div><ChevronRight size={14} /></button>)}</div></section>}</>}

      <section className="section-block category-hub"><div className="section-heading"><div><p className="eyebrow teal-text">{homeMode === "save" ? "SAVE YOUR WAY" : homeMode === "play" ? "MAKE A PLAN" : "BUILD YOUR FUTURE"}</p><h3>{homeMode === "save" ? "Browse categories" : homeMode === "play" ? "What feels fun?" : "Choose your next step"}</h3></div></div><div className="category-scroll">{modeCategories.map((item) => { const Icon = item.icon; return <button key={item.name} onClick={() => onCategory(item.name as CategoryName)} aria-label={`Browse ${item.name}`}><span className="category-art category-monochrome-icon"><Icon size={34} strokeWidth={2.15} aria-hidden="true" /><b>{item.name}</b></span></button>; })}</div></section>

      {homeMode === "save" && <section className="section-block vendor-section"><div className="section-heading"><div><p className="eyebrow coral-text">BRANDS YOU KNOW</p><h3>Popular partners</h3></div><button onClick={() => onSearch("partner")}>All partners</button></div><div className="vendor-shelf">{deals.slice(0, 12).map((deal) => <button key={deal.id} onClick={() => onSelect(deal)}><span>{deal.logo ? <img src={deal.logo} alt={`${deal.name} logo`} /> : <img className="vendor-photo" src={deal.image} alt="" />}</span><b>{deal.name}</b><small>{deal.saving}</small></button>)}</div></section>}

      {homeMode === "save" && <><section className="section-block">
        <div className="section-heading"><div><p className="eyebrow coral-text">GOOD STUFF, CLOSE BY</p><h3>Top picks near you</h3></div><button onClick={() => onTab("search")}>See all</button></div>
        <div className="deal-carousel">
          {visibleDeals.map((deal) => <DealCard key={deal.id} deal={deal} saved={saved.has(deal.id)} onSelect={onSelect} onSave={onSave} />)}
        </div>
      </section>

      <section className="repeat-section section-block">
        <div className="section-heading"><div><p className="eyebrow teal-text">READY WHEN YOU ARE</p><h3>Use it again</h3></div><button onClick={() => onTab("saved")}>My offers</button></div>
        <button className="repeat-ticket" onClick={() => onSelect(deals[1])}>
          <div className="repeat-logo">S</div>
          <span><small>STARBUCKS · PANAMPILLY NAGAR</small><b>Buy 1 coffee, get 1 free</b><em>Save ₹320</em></span>
          <div className="gift-bubble"><Gift size={20} /></div>
        </button>
      </section>

      <div className="student-value-stack">
        <section className="section-block value-section student-exclusive">
          <div className="section-heading"><div><p className="eyebrow teal-text">FOR STUDENT LIFE</p><h3>Exclusive student deals</h3></div><button onClick={() => onSearch("student")}>See all</button></div>
          <div className="mini-deals">
            {[deals[1], deals[11], deals[8]].map((deal) => <button key={deal.id} onClick={() => onSelect(deal)}><img src={deal.image} alt="" /><span><b>{deal.name}</b><small>{deal.saving}</small></span></button>)}
          </div>
        </section>
        <section className="section-block value-section meals-under-hundred">
          <div className="section-heading"><div><p className="eyebrow teal-text">QUICK BITES, TINY PRICES</p><h3>Meals under ₹100</h3></div><button onClick={() => onSearch("meals under 100")}>See all</button></div>
          <div className="mini-deals meal-deals">
            {[
              { deal: deals[0], name: "Mini Kerala meals", price: "₹99" },
              { deal: deals[14], name: "Crispy snack box", price: "₹89" },
              { deal: deals[3], name: "Burger & lime", price: "₹99" },
            ].map(({ deal, name, price }) => <button key={name} onClick={() => onSelect(deal)}><img src={deal.image} alt="" /><span><b>{name}</b><small>{price}</small></span></button>)}
          </div>
        </section>
      </div></>}

      {homeMode === "play" && <><section className="section-block city-section">
        <div className="section-heading"><div><p className="eyebrow coral-text">KERALA, THIS WEEK</p><h3>Go do something fun</h3></div><button onClick={() => onSearch("experience")}>More</button></div>
        <div className="city-stories">{cityStories.map((story) => <button key={story.title} onClick={() => onSearch(story.query)}><img src={story.image} alt="" /><span><b>{story.title}</b><small>{story.note}</small></span></button>)}</div>
      </section><button className="win-teaser" onClick={onRewards}><span><Gift size={23} /></span><div><small>REDEEM POINTS</small><b>Turn points into good stuff</b><p>Use your Kouponly points for food, experiences and rewards.</p></div><ChevronRight size={19} /></button></>}

      {homeMode === "grow" && <><section className="section-block opportunity-section"><div className="section-heading"><div><p className="eyebrow coral-text">MORE WAYS TO GROW</p><h3>Learn, freelance or find work</h3></div><button onClick={() => onSearch("opportunity")}>See all</button></div><div className="opportunity-list">{opportunities.map(({ type, title, meta, icon: Icon }) => <button key={title} onClick={() => onSearch(title)}><span><Icon size={20} /></span><div><small>{type}</small><b>{title}</b><p>{meta}</p></div><ChevronRight size={17} /></button>)}</div></section><section className="profile-progress"><div className="progress-ring">62%</div><div><small>YOUR OPPORTUNITY PROFILE</small><b>Two steps from standing out</b><p>Add your skills and availability to get better matches.</p><button onClick={() => onTab("profile")}>Finish profile</button></div></section></>}

      {homeMode === "save" && <section className="section-block popular-section">
        <div className="section-heading"><div><p className="eyebrow teal-text">THE CROWD KNOWS</p><h3>Popular this week</h3></div></div>
        {deals.slice(1, 4).map((deal, index) => <button className="compact-deal" key={deal.id} onClick={() => onSelect(deal)}><img src={deal.image} alt="" /><span><b>{deal.name}</b><small>{deal.offer}</small><em>{deal.saving}</em></span><i>{String(index + 1).padStart(2, "0")}</i></button>)}
      </section>}
    </div>
  );
}

function DealCard({ deal, saved, onSelect, onSave }: { deal: Deal; saved: boolean; onSelect: (deal: Deal) => void; onSave: (id: number) => void }) {
  return (
    <article className="deal-card" role="button" tabIndex={0} aria-label={`Open ${deal.name}: ${deal.offer}`} onClick={() => onSelect(deal)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(deal); } }}>
      <div className="deal-image"><img src={deal.image} alt={deal.name} /><span className="distance"><Navigation size={12} />{deal.distance}</span><button className={saved ? "heart saved" : "heart"} onClick={(event) => { event.stopPropagation(); onSave(deal.id); }} aria-label={saved ? "Remove from saved" : "Save offer"}><Heart size={18} fill={saved ? "currentColor" : "none"} /></button></div>
      <div className="deal-body"><span className="deal-type">{deal.category}</span><h4>{deal.name}</h4><p>{deal.offer}</p><div><b>{deal.saving}</b><span><Star size={13} fill="currentColor" />{deal.rating}</span></div></div>
    </article>
  );
}

function Saved({ saved, onSelect, onSave, notify }: { saved: Set<number>; onSelect: (deal: Deal) => void; onSave: (id: number) => void; notify: (message: string) => void }) {
  const [segment, setSegment] = useState("Places");
  const savedDeals = deals.filter((deal) => saved.has(deal.id));
  return (
    <div className="screen">
      <header className="page-header"><div><p className="eyebrow coral-text">YOUR COLLECTION</p><h2>Saved for later</h2><p>All your good ideas, in one place.</p></div><span className="count-badge">{saved.size}</span></header>
      <div className="segments">{["Places", "Offers", "Used"].map((item) => <button className={segment === item ? "active" : ""} key={item} onClick={() => setSegment(item)}>{item}</button>)}</div>
      {segment === "Places" && (savedDeals.length ? <div className="saved-list">{savedDeals.map((deal) => <article className="saved-card" key={deal.id}><button className="saved-card-main" onClick={() => onSelect(deal)}><img src={deal.image} alt="" /><span className="saved-card-copy"><small>{deal.category} · {deal.distance}</small><b>{deal.name}</b><p>{deal.offer}</p><em>{deal.saving}</em></span></button><button className="saved-heart" onClick={() => onSave(deal.id)} aria-label={`Remove ${deal.name} from saved`}><Heart size={19} fill="currentColor" /></button></article>)}</div> : <EmptyState />)}
      {segment === "Offers" && (savedDeals.length ? <div className="saved-offers">{savedDeals.map((deal) => <button key={deal.id} onClick={() => onSelect(deal)}><span><TicketPercent size={20} /></span><div><small>{deal.name}</small><b>{deal.offer}</b><em>{deal.saving}</em></div><ChevronRight size={18} /></button>)}</div> : <EmptyState />)}
      {segment === "Used" && <div className="used-empty"><span><Check size={25} /></span><h3>No used offers yet</h3><p>Redeemed discounts and booking codes will appear here.</p></div>}
      <button className="saved-tip" onClick={() => notify("Gift link created for your saved offers")}><Gift size={22} /><div><b>Share the savings</b><p>Gift a saved offer to someone you love.</p></div><ChevronRight size={18} /></button>
    </div>
  );
}

function EmptyState() {
  return <div className="empty-state"><span><Bookmark size={28} /></span><h3>Nothing here yet</h3><p>Tap the heart on an offer you love and it will wait for you here.</p></div>;
}

function AccountPage({ page, onBack, notify, theme, onThemeChange }: { page: AccountPageKey; onBack: () => void; notify: (message: string) => void; theme: "light" | "dark"; onThemeChange: (theme: "light" | "dark") => void }) {
  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ name: "Neil Jose Pillard", email: "neil.j.pillard@gmail.com", mobile: "+91 98765 43210", city: "Kochi, Kerala" });
  const [giftTab, setGiftTab] = useState<"Received" | "Sent">("Received");
  const [giftAccepted, setGiftAccepted] = useState(false);
  const [giftComposer, setGiftComposer] = useState(false);
  const [giftChoice, setGiftChoice] = useState("Starbucks coffee for two");
  const [giftRecipient, setGiftRecipient] = useState("");
  const [sentGift, setSentGift] = useState<string | null>(null);
  const [offerAlerts, setOfferAlerts] = useState(true);
  const [creatorUpdates, setCreatorUpdates] = useState(true);
  const [settingPicker, setSettingPicker] = useState<"location" | "language" | null>(null);
  const [location, setLocation] = useState("Kochi");
  const [language, setLanguage] = useState("English");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [openLegal, setOpenLegal] = useState<string | null>(null);
  const titles: Record<AccountPageKey, { eyebrow: string; title: string; copy: string }> = {
    personal: { eyebrow: "YOUR ACCOUNT", title: "Personal details", copy: "Keep the basics current so your offers and applications stay relevant." },
    savings: { eyebrow: "YOUR IMPACT", title: "Savings history", copy: "A clear record of every Kouponly saving and redemption." },
    earnings: { eyebrow: "CREATOR WALLET", title: "Your earnings", copy: "Track every UGC payment from approved brief to bank transfer." },
    membership: { eyebrow: "YOUR ACCESS", title: "Membership", copy: "See your current pass and the benefits you can unlock next." },
    gifts: { eyebrow: "SHARE THE GOOD STUFF", title: "Gifts", copy: "Send and receive offers without passing around screenshots." },
    settings: { eyebrow: "MAKE IT YOURS", title: "Preferences", copy: "Choose how Kouponly looks, speaks and keeps you updated." },
    help: { eyebrow: "WE’RE HERE", title: "Help & support", copy: "Fast answers for accounts, offers, payments and redemptions." },
    feedback: { eyebrow: "TALK TO US", title: "Send feedback", copy: "Tell us what feels great, confusing or missing." },
    legal: { eyebrow: "THE IMPORTANT BITS", title: "Terms & privacy", copy: "Plain-language information about your account and data." },
  };
  const heading = titles[page];
  return <div className="screen account-page">
    <button className="inline-back" onClick={onBack}><ArrowLeft size={18} /> Back</button>
    <header><p className="eyebrow coral-text">{heading.eyebrow}</p><h2>{heading.title}</h2><p>{heading.copy}</p></header>

    {page === "personal" && <section className="account-card detail-fields">{editingProfile ? <form className="profile-edit-form" onSubmit={(event) => { event.preventDefault(); setEditingProfile(false); notify("Profile details saved"); }}><label><span>Full name</span><input value={profileDraft.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} required /></label><label><span>Email</span><input type="email" value={profileDraft.email} onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value })} required /></label><label><span>Mobile</span><input value={profileDraft.mobile} onChange={(event) => setProfileDraft({ ...profileDraft, mobile: event.target.value })} required /></label><label><span>Home city</span><input value={profileDraft.city} onChange={(event) => setProfileDraft({ ...profileDraft, city: event.target.value })} required /></label><div className="form-actions"><button type="button" onClick={() => setEditingProfile(false)}>Cancel</button><button type="submit">Save changes</button></div></form> : <><label><span>Full name</span><b>{profileDraft.name}</b></label><label><span>Email</span><b>{profileDraft.email}</b></label><label><span>Mobile</span><b>{profileDraft.mobile}</b></label><label><span>Home city</span><b>{profileDraft.city}</b></label><button onClick={() => setEditingProfile(true)}>Edit details <ChevronRight size={17} /></button></>}</section>}

    {page === "earnings" && <><section className="creator-wallet"><div><small>TOTAL EARNED</small><b>₹12,500</b><p>from 3 completed campaigns</p></div><span><WalletCards size={24} /><small>NEXT PAYOUT</small><b>₹6,000</b><p>Expected 8 Aug</p></span></section><section className="account-card earnings-list"><div className="earnings-list-heading"><h3>Payment activity</h3><span>All time</span></div><button onClick={() => notify("Paragon campaign payment opened")}><span className="earning-brand"><Utensils size={18} /></span><span><b>Paragon dinner Reel</b><small>Paid to bank · 28 Jul</small></span><em className="paid">+₹4,500</em></button><button onClick={() => notify("Nykaa campaign payout details opened")}><span className="earning-brand"><Sparkles size={18} /></span><span><b>Nykaa beauty unboxing</b><small>Approved · payout processing</small></span><em>₹6,000</em></button><button onClick={() => notify("Marriott campaign payment opened")}><span className="earning-brand"><Clapperboard size={18} /></span><span><b>Kochi Marriott pool story</b><small>Paid to bank · 12 Jul</small></span><em className="paid">+₹8,000</em></button></section><section className="earnings-note"><Check size={17} /><div><b>How payouts work</b><p>Once your content is approved and posted, payment is released to your registered bank account.</p></div></section></>}

    {page === "savings" && <><section className="savings-overview"><span><small>TOTAL SAVED</small><b>₹2,400</b><p>this month</p></span><span><small>OFFERS USED</small><b>8</b><p>across Kochi</p></span></section><section className="account-card activity-list"><h3>Recent activity</h3><button onClick={() => notify("Paragon redemption details opened")}><span className="activity-icon"><Utensils size={18} /></span><span><b>Paragon Restaurant</b><small>Buy one biryani, get one free · Today</small></span><em>+₹480</em></button><button onClick={() => notify("Starbucks redemption details opened")}><span className="activity-icon"><Coffee size={18} /></span><span><b>Starbucks</b><small>Second handcrafted drink · Jul 28</small></span><em>+₹320</em></button><button onClick={() => notify("PVR redemption details opened")}><span className="activity-icon"><Clapperboard size={18} /></span><span><b>PVR Cinemas</b><small>Two premium tickets · Jul 22</small></span><em>+₹350</em></button></section></>}

    {page === "membership" && <><section className="member-pass"><small>KOUPONLY</small><h3>STUDENT PASS</h3><p>Active through 31 July 2027</p><span>KP · 24008</span></section><section className="account-card perk-list"><h3>Included now</h3><p><Check size={16} /> Member prices at all Kerala partners</p><p><Check size={16} /> Weekly points challenges</p><p><Check size={16} /> Early access to experiences</p><div className="gold-preview"><b>Gold Card</b><small>Campus Ambassadors can unlock free food, free experiences and member extras after selection.</small><button onClick={() => notify("Campus Ambassador details opened")}>See eligibility</button></div></section></>}

    {page === "gifts" && <section className="account-card gifts-page"><div className="gift-tabs">{(["Received", "Sent"] as const).map((tab) => <button key={tab} className={giftTab === tab ? "active" : ""} onClick={() => { setGiftTab(tab); setGiftComposer(false); }}>{tab}</button>)}</div>{giftTab === "Received" ? <article><span><Gift size={22} /></span><div><small>FROM ANU</small><b>Coffee for two at Starbucks</b><p>{giftAccepted ? "Saved and ready to use" : "Use before 12 August"}</p></div><button disabled={giftAccepted} onClick={() => { setGiftAccepted(true); notify("Gift added to Saved"); }}>{giftAccepted ? "Accepted" : "Accept"}</button></article> : <div className="gift-sent-list">{sentGift && <article><span><Check size={21} /></span><div><small>SENT TO {giftRecipient || "RECIPIENT"}</small><b>{sentGift}</b><p>Claim link sent just now</p></div></article>}<article><span><Check size={21} /></span><div><small>SENT TO MAYA</small><b>PVR tickets for two</b><p>Accepted · 30 July</p></div></article></div>}{giftComposer ? <form className="gift-composer" onSubmit={(event) => { event.preventDefault(); setSentGift(giftChoice); setGiftComposer(false); setGiftTab("Sent"); notify("Gift claim link sent"); }}><label><span>Choose a saved offer</span><select value={giftChoice} onChange={(event) => setGiftChoice(event.target.value)}><option>Starbucks coffee for two</option><option>PVR tickets for two</option><option>Wonderla day pass</option></select></label><label><span>Recipient mobile</span><input inputMode="tel" value={giftRecipient} onChange={(event) => setGiftRecipient(event.target.value)} placeholder="+91" required /></label><button className="feedback-submit" type="submit">Create & send claim link</button></form> : <button className="full-outline" onClick={() => setGiftComposer(true)}>Send a gift</button>}</section>}

    {page === "settings" && <section className="account-card preference-list"><button onClick={() => setSettingPicker(settingPicker === "location" ? null : "location")} aria-expanded={settingPicker === "location"}><span><MapPin size={18} /><b>Location</b></span><em>{location} <ChevronRight size={16} /></em></button>{settingPicker === "location" && <div className="setting-options" aria-label="Choose location">{["Kochi", "Thrissur", "Kozhikode", "Thiruvananthapuram"].map((city) => <button key={city} className={location === city ? "active" : ""} onClick={() => { setLocation(city); setSettingPicker(null); notify(`Location changed to ${city}`); }}>{city}{location === city && <Check size={14} />}</button>)}</div>}<button onClick={() => setSettingPicker(settingPicker === "language" ? null : "language")} aria-expanded={settingPicker === "language"}><span><MessageCircle size={18} /><b>Language</b></span><em>{language} <ChevronRight size={16} /></em></button>{settingPicker === "language" && <div className="setting-options" aria-label="Choose language">{["English", "Malayalam"].map((item) => <button key={item} className={language === item ? "active" : ""} onClick={() => { setLanguage(item); setSettingPicker(null); notify(`Language changed to ${item}`); }}>{item}{language === item && <Check size={14} />}</button>)}</div>}<button onClick={() => { setOfferAlerts((value) => !value); notify(`Offer alerts turned ${offerAlerts ? "off" : "on"}`); }} aria-pressed={offerAlerts}><span><Bell size={18} /><b>Offer alerts</b></span><i className={`toggle ${offerAlerts ? "on" : ""}`} /></button><button onClick={() => { setCreatorUpdates((value) => !value); notify(`Creator updates turned ${creatorUpdates ? "off" : "on"}`); }} aria-pressed={creatorUpdates}><span><Clapperboard size={18} /><b>Creator updates</b></span><i className={`toggle ${creatorUpdates ? "on" : ""}`} /></button><div className="appearance-control"><span><Sparkles size={18} /><b>Appearance</b></span><div className="setting-options compact"><button className={theme === "light" ? "active" : ""} onClick={() => onThemeChange("light")} aria-pressed={theme === "light"}>Light</button><button className={theme === "dark" ? "active" : ""} onClick={() => onThemeChange("dark")} aria-pressed={theme === "dark"}>Dark</button></div></div></section>}

    {page === "help" && <><section className="help-actions"><a href="mailto:hello@kouponly.com?subject=Kouponly%20support"><MessageCircle size={21} /><span><b>Chat with us</b><small>Usually replies in 5 min</small></span></a><a href="tel:+914844002400"><Phone size={21} /><span><b>Call support</b><small>9am–8pm, every day</small></span></a></section><section className="account-card faq-list"><h3>Popular questions</h3>{["How does in-store redemption work?", "Where is my online offer code?", "How do creator payments work?", "What does the Gold Card include?"].map((question) => <div className="faq-item" key={question}><button onClick={() => setOpenFaq(openFaq === question ? null : question)} aria-expanded={openFaq === question}><b>{question}</b><ChevronRight size={17} /></button>{openFaq === question && <p>{question.startsWith("How does") ? "At the venue, a staff member confirms availability and enters the private four-digit partner PIN on your phone." : question.startsWith("Where") ? "Confirm the online redemption to reveal a ten-minute code and a direct partner-site button." : question.startsWith("How do creator") ? "Approved, posted work moves to payout processing and appears in Creator earnings with an expected date." : "Selected campus ambassadors unlock rotating food, experience and member freebies at participating partners."}</p>}</div>)}</section></>}

    {page === "feedback" && <section className="account-card feedback-form">{feedbackSent ? <div className="feedback-success"><span><Check size={24} /></span><h3>Thanks for helping us improve</h3><p>Your feedback has been recorded for the Kouponly product team.</p><button className="full-outline" onClick={() => setFeedbackSent(false)}>Send another</button></div> : <><label htmlFor="feedback">What should we know?</label><textarea id="feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Write your thoughts here…" /><div><button onClick={() => setFeedback("I found something confusing in the app.")}>Confusing</button><button onClick={() => setFeedback("I have an idea for Kouponly.")}>I have an idea</button></div><button className="feedback-submit" disabled={!feedback.trim()} onClick={() => { setFeedbackSent(true); setFeedback(""); notify("Thanks — feedback sent"); }}>Send feedback</button></>}</section>}

    {page === "legal" && <section className="account-card legal-list">{[{ title: "Terms of use", note: "How memberships, offers and rewards work", body: "Offers show their limits, renewal date and redemption method before confirmation. Unless stated otherwise, a recurring offer includes three uses per cycle." }, { title: "Privacy policy", note: "What we collect and how we protect it", body: "Kouponly uses account, preference and requested location data to operate the service. Marketing preferences remain optional and controllable." }, { title: "Creator terms", note: "Campaign delivery, usage rights and payment", body: "Every brief defines deliverables, review rounds, posting requirements, usage rights and payment before a creator applies." }].map((item) => <div className="legal-item" key={item.title}><button onClick={() => setOpenLegal(openLegal === item.title ? null : item.title)} aria-expanded={openLegal === item.title}><span><b>{item.title}</b><small>{item.note}</small></span><ChevronRight size={17} /></button>{openLegal === item.title && <p>{item.body}</p>}</div>)}<p>Kouponly uses only the information needed to run your account, personalise discovery and verify redemptions. You stay in control of marketing preferences.</p></section>}
  </div>;
}

function RewardsHub({ notify, onBack, onBrowseDeals }: { notify: (message: string) => void; onBack: () => void; onBrowseDeals: () => void }) {
  const rewards: RewardItem[] = [
    { name: "Free coffee", detail: "Any regular drink", points: 200, image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=500&q=88" },
    { name: "Free burger meal", detail: "Burger, fries and drink", points: 450, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=88" },
    { name: "Pottery workshop", detail: "One beginner session", points: 650, image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=500&q=88" },
    { name: "Kayaking experience", detail: "Kadamakkudy morning", points: 900, image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=500&q=88" },
  ];
  const [points, setPoints] = useState(680);
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [redeemedRewards, setRedeemedRewards] = useState<Set<string>>(() => new Set());
  return (
    <div className="screen rewards-screen">
      <button className="inline-back" onClick={onBack}><ArrowLeft size={18} /> Back to profile</button>
      <header className="page-header rewards-header"><div><p className="eyebrow coral-text">KOUPONLY REWARDS</p><h2>Complete. Earn. Redeem.</h2><p>Finish useful challenges, collect points and exchange them for real perks. No cash or chance-based prizes.</p></div><span className="points-pill"><Trophy size={16} />{points}</span></header>
      <section className="points-overview"><div><small>AVAILABLE</small><b>{points}</b><span>points</span></div><div><small>EARNED THIS MONTH</small><b>250</b><span>from 3 challenges</span></div><div><small>NEXT LEVEL</small><b>{Math.max(0, 1000 - points)}</b><span>to Gold</span></div></section>
      <section className="challenge-spotlight"><div><span>NEXT CHALLENGE</span><h3>Use 3 Kouponly discounts</h3><p>Use one more eligible offer to earn 150 points.</p><div className="challenge-progress"><i style={{ width: "66%" }} /><small>2 of 3 complete</small></div><button onClick={onBrowseDeals}><TicketPercent size={17} /> Find a discount</button></div><strong>+150<small>POINTS</small></strong></section>
      <section className="section-block"><div className="section-heading"><div><p className="eyebrow coral-text">SPEND YOUR POINTS</p><h3>Redeem something good</h3></div><button onClick={() => notify("Choose a reward, confirm the points, then let the partner verify it with their PIN.")}>How it works</button></div><div className="reward-shop">{rewards.map((reward) => { const redeemed = redeemedRewards.has(reward.name); const available = reward.points <= points && !redeemed; return <article className={redeemed ? "redeemed" : ""} key={reward.name}><img src={reward.image} alt="" /><div><b>{reward.name}</b><small>{reward.detail}</small><em><Trophy size={12} /> {reward.points} points</em></div><button disabled={!available} onClick={() => setSelectedReward(reward)}>{redeemed ? "Redeemed" : available ? "Redeem" : `${reward.points - points} short`}</button></article>; })}</div></section>
      <section className="section-block missions"><div className="section-heading"><div><p className="eyebrow teal-text">ACTIVE CHALLENGES</p><h3>More ways to earn points</h3></div></div>
        <button onClick={() => notify("Your offer activity opened")}><span><TicketPercent size={17} /></span><div><b>Use 3 discounts</b><small>2 of 3 complete</small></div><em>+150</em></button>
        <button onClick={() => { navigator.clipboard?.writeText("KPL-NEIL"); notify("Your referral code KPL-NEIL was copied"); }}><span><Share2 size={17} /></span><div><b>Invite 10 friends with KPL-NEIL</b><small>4 of 10 joined</small></div><em>+500</em></button>
        <button onClick={() => notify("Profile checklist opened")}><span><UserRound size={17} /></span><div><b>Complete your profile</b><small>62% complete</small></div><em>+100</em></button>
        <button onClick={() => notify("Category challenge opened")}><span><Compass size={17} /></span><div><b>Try offers from 3 categories</b><small>1 of 3 complete</small></div><em>+120</em></button>
      </section>
      {selectedReward && <RewardRedemptionFlow reward={selectedReward} onClose={() => setSelectedReward(null)} onRedeemed={() => { setPoints((current) => Math.max(0, current - selectedReward.points)); setRedeemedRewards((current) => new Set(current).add(selectedReward.name)); notify(`${selectedReward.name} redeemed successfully`); }} />}
    </div>
  );
}

function RewardRedemptionFlow({ reward, onClose, onRedeemed }: { reward: RewardItem; onClose: () => void; onRedeemed: () => void }) {
  const [step, setStep] = useState<"confirm" | "pin" | "success">("confirm");
  const [pin, setPin] = useState("");
  const verifyReward = () => {
    if (pin.length !== 4) return;
    onRedeemed();
    setStep("success");
  };
  return <div className="redeem-overlay" role="dialog" aria-modal="true" aria-label="Redeem reward"><div className="redeem-sheet reward-redeem-sheet"><button className="redeem-close" onClick={onClose} aria-label="Close"><X size={19} /></button>{step === "confirm" && <><span className="redeem-symbol"><Trophy size={25} /></span><p className="eyebrow coral-text">CONFIRM REWARD</p><h3>Redeem {reward.name}?</h3><p>Once the partner verifies this reward, {reward.points} points will be deducted from your balance. Points cannot be restored after the item is served or the experience is activated.</p><div className="reward-confirm-card"><img src={reward.image} alt="" /><span><b>{reward.name}</b><small>{reward.detail}</small><em><Trophy size={12} /> {reward.points} points</em></span></div><button className="redeem-primary" onClick={() => setStep("pin")}>Confirm and continue</button><button className="redeem-secondary" onClick={onClose}>Not now</button></>}{step === "pin" && <><span className="redeem-symbol vendor"><Store size={25} /></span><p className="eyebrow coral-text">PARTNER VERIFICATION</p><h3>Hand this phone to the partner</h3><p>The partner must confirm that your free item is available, then enter their four-digit Kouponly PIN.</p><div className="redeem-warning"><Gift size={18} /><span><b>{reward.name}</b><small>{reward.points} points will be used after verification.</small></span></div><label className="vendor-pin"><span>PARTNER PIN</span><input autoFocus inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" /></label><button className="redeem-primary" disabled={pin.length !== 4} onClick={verifyReward}>Verify and redeem</button><button className="redeem-secondary" onClick={() => setStep("confirm")}>Back</button></>}{step === "success" && <><span className="redeem-symbol success"><Check size={25} /></span><p className="eyebrow teal-text">REWARD REDEEMED</p><h3>Enjoy your {reward.name}</h3><p>The partner PIN was accepted, your points were deducted and this reward was added to your activity.</p><div className="reward-success-code"><small>REDEMPTION COMPLETE</small><b><Check size={18} /> Verified by partner</b></div><button className="redeem-primary" onClick={onClose}>Done</button></>}</div></div>;
}

const directoryTypeLabel = (type: DirectoryItem["type"]) => type === "Vendor" ? "Partner" : type;

function CategoryView({ category, onBack, onOpen }: { category: CategoryName; onBack: () => void; onOpen: (item: DirectoryItem) => void }) {
  const details = categoryDetails[category];
  const Icon = details.icon;
  const [query, setQuery] = useState("");
  const [subcategory, setSubcategory] = useState("All");
  const [nearest, setNearest] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const activeSubcategory = details.subcategories.find((item) => item.label === subcategory) ?? details.subcategories[0];
  const itemText = (item: DirectoryItem) => `${item.title} ${item.subtitle} ${item.type} ${item.tag} ${item.keywords} ${item.description}`.toLowerCase();
  const foodCategory = ["Mains", "Snacks", "Drinks", "Sweets", "Cuisines", "Dietary", "Breakfast", "Buffet"].includes(category);
  const categoryItems = directoryItems.filter((item) => foodCategory
    ? item.subtitle.toLowerCase().startsWith(category.toLowerCase())
    : details.match.some((term) => itemText(item).includes(term.toLowerCase())));
  const subcategoryItems = foodCategory && subcategory !== "All"
    ? foodSubcategoryPartners.filter((item) => item.subtitle.toLowerCase().startsWith(`${category.toLowerCase()} · ${subcategory.toLowerCase()} ·`))
    : categoryItems;
  const visibleItems = subcategoryItems.filter((item) => {
    const haystack = itemText(item);
    const matchesSearch = !normalizedQuery || normalizedQuery.split(/\s+/).every((term) => haystack.includes(term));
    const matchesSubcategory = foodCategory || !activeSubcategory.terms.length || activeSubcategory.terms.some((term) => haystack.includes(term.toLowerCase()));
    return matchesSearch && matchesSubcategory;
  }).sort((a, b) => nearest ? (a.distance || Number.MAX_SAFE_INTEGER) - (b.distance || Number.MAX_SAFE_INTEGER) : b.trend - a.trend);

  return (
    <div className="screen category-page">
      <header className="category-destination-header">
        <div className="category-page-nav"><button className="back-button category-back" onClick={onBack} aria-label="Back to home"><ArrowLeft size={20} /></button><span><MapPin size={13} /> Kochi deals</span></div>
        <div className="category-hero-copy"><p className="eyebrow">EXPLORE CATEGORY</p><h2>{category}</h2><p>{details.description}</p><span><Icon size={16} /> {categoryItems.length} places & offers</span></div>
        <span className="category-destination-symbol" aria-hidden="true"><Icon size={42} strokeWidth={1.9} /></span>
      </header>

      <label className="search-field category-page-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search in ${category}`} autoComplete="off" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear category search"><X size={16} /></button>}</label>

      <button className={`nearest-category ${nearest ? "active" : ""}`} onClick={() => setNearest((current) => !current)} aria-pressed={nearest}><span><Navigation size={17} /></span><div><b>Nearest to me</b><small>{nearest ? "Showing closest first" : "Use your Kochi location"}</small></div><span className="nearest-switch"><i /></span></button>

      <div className="subcategory-row" aria-label={`${category} subcategories`}>{details.subcategories.map((item) => <button key={item.label} className={subcategory === item.label ? "active" : ""} onClick={() => setSubcategory(item.label)}>{item.label}</button>)}</div>

      <div className="category-result-heading"><div><p className="eyebrow">{subcategory === "All" ? "ALL PICKS" : subcategory.toUpperCase()}</p><h3>{visibleItems.length} result{visibleItems.length === 1 ? "" : "s"}</h3></div><span>{nearest ? <><Navigation size={12} /> Closest first</> : "Top rated"}</span></div>

      <section className="directory-list category-directory-list">{visibleItems.map((item) => <button key={item.id} onClick={() => onOpen(item)}><span className={`directory-media ${item.logo ? "logo" : ""}`}><img src={item.logo ?? item.image} alt="" /></span><div className="partner-card-body"><span className="partner-card-meta"><small>{directoryTypeLabel(item.type)}{item.distance > 0 ? ` · ${item.distance} km` : " · Online"}</small><i>Offer live</i></span><b>{item.title}</b><p><MapPin size={11} /> {item.subtitle.split("·").slice(1).join("·").trim() || item.subtitle}</p><em>{item.tag}</em></div><span className="partner-card-arrow"><ChevronRight size={17} /></span></button>)}{!visibleItems.length && <div className="search-empty category-empty"><span><Search size={23} /></span><h3>No matches in this filter</h3><p>Try another subcategory or clear your search.</p><button onClick={() => { setQuery(""); setSubcategory("All"); }}>Show all {category}</button></div>}</section>
    </div>
  );
}

function SearchView({ query, setQuery, filter, setFilter, sortBy, setSortBy, onOpen }: { query: string; setQuery: (value: string) => void; filter: string; setFilter: (value: string) => void; sortBy: SearchSort; setSortBy: (value: SearchSort) => void; onOpen: (item: DirectoryItem) => void }) {
  const filterGroups = ["All", "Partners", "Offers", "Go out", "Grow", "Rewards"];
  const quickSearches = ["Near me", "Food", "Partners", "Free", "Internships", "Creator work"];
  const searchTerms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matchesFilter = (type: DirectoryItem["type"]) => filter === "All" || (filter === "Partners" && type === "Vendor") || (filter === "Offers" && type === "Offer") || (filter === "Go out" && type === "Experience") || (filter === "Grow" && ["Course", "Internship", "Freelance", "Job"].includes(type)) || (filter === "Rewards" && type === "Prize");
  const visibleItems = directoryItems.filter((item) => {
    const haystack = `${item.title} ${item.subtitle} ${item.type} ${item.tag} ${item.keywords} ${item.description}`.toLowerCase();
    const queryMatches = searchTerms.length === 0 || searchTerms.every((term) => term === "near" || term === "me" ? true : haystack.includes(term));
    return matchesFilter(item.type) && queryMatches;
  }).sort((a, b) => {
    if (sortBy === "A-Z") return a.title.localeCompare(b.title);
    if (sortBy === "Highest offer") return b.offer - a.offer;
    if (sortBy === "Newest") return b.newest - a.newest;
    if (sortBy === "Nearest") return (a.distance || Number.MAX_SAFE_INTEGER) - (b.distance || Number.MAX_SAFE_INTEGER);
    return b.trend - a.trend;
  });
  const resetSearch = () => { setQuery(""); setFilter("All"); setSortBy("Trending"); };
  return (
    <div className="screen directory-screen search-redesign">
      <header className="search-hero"><p className="eyebrow coral-text">SEARCH KOUPONLY</p><h2>Everything, one search.</h2><p>Kerala partners, offers, experiences and opportunities.</p><span>{directoryItems.length} things to explore</span></header>
      <label className="search-field directory-search"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search food, jobs, partners, experiences..." autoComplete="off" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={17} /></button>}</label>
      {!query && <div className="quick-searches">{quickSearches.map((item) => <button key={item} onClick={() => { setQuery(item === "Near me" ? "" : item === "Partners" ? "partner" : item.toLowerCase()); setFilter(item === "Partners" ? "Partners" : item === "Internships" || item === "Creator work" ? "Grow" : "All"); setSortBy(item === "Near me" ? "Nearest" : "Trending"); }}>{item === "Near me" ? <Navigation size={13} /> : <Sparkles size={13} />}{item}</button>)}</div>}
      <div className="directory-filters" aria-label="Search filters">{filterGroups.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
      <div className="sort-row"><span><SlidersHorizontal size={14} /> Sort</span><div>{(["Trending", "A-Z", "Highest offer", "Newest", "Nearest"] as SearchSort[]).map((item) => <button key={item} className={sortBy === item ? "active" : ""} onClick={() => setSortBy(item)}>{item}</button>)}</div></div>
      <div className="directory-result-title"><div><b>{visibleItems.length} result{visibleItems.length === 1 ? "" : "s"}</b><small>{query ? ` for “${query}”` : ` across ${filter.toLowerCase()}`}</small></div><span>{sortBy === "Nearest" ? <><Navigation size={12} /> Near you</> : sortBy}</span></div>
      <section className="directory-list">{visibleItems.map((item) => <button key={item.id} onClick={() => onOpen(item)}><span className={`directory-media ${item.logo ? "logo" : ""}`}><img src={item.logo ?? item.image} alt="" /></span><div><small>{directoryTypeLabel(item.type)}{item.distance > 0 ? ` · ${item.distance} km` : " · Online"}</small><b>{item.title}</b><p>{item.subtitle}</p><em>{item.tag}</em></div><ChevronRight size={18} /></button>)}{!visibleItems.length && <div className="search-empty"><span><Search size={24} /></span><h3>No exact match yet</h3><p>Try a broader word, another category, or reset the filters.</p><button onClick={resetSearch}>Clear search</button></div>}</section>
    </div>
  );
}

function ListingDetail({ item, onBack, notify }: { item: DirectoryItem; onBack: () => void; notify: (message: string) => void }) {
  const [completed, setCompleted] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const redeemable = ["Vendor", "Offer", "Experience"].includes(item.type);
  const redemptionMode = item.type === "Experience" || item.redemption === "online" ? "online" : "inStore";
  const actionMessage = item.type === "Experience" ? "Booking request sent" : item.type === "Course" ? "Course added to your learning list" : item.type === "Prize" ? "Giveaway entry confirmed" : "Application sent";
  return (
    <div className="listing-detail">
      <div className="listing-detail-hero"><img src={item.image} alt="" /><button onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button><span>{directoryTypeLabel(item.type)}</span></div>
      <div className="listing-detail-body"><p className="eyebrow coral-text">{item.tag}</p><h2>{item.title}</h2><p className="listing-subtitle"><MapPin size={15} />{item.subtitle}</p><div className="listing-detail-meta"><span><Star size={15} fill="currentColor" /> Popular on Kouponly</span><span><Navigation size={15} />{item.distance ? `${item.distance} km away` : "Available online"}</span></div><section><h3>What to expect</h3><p>{item.description}</p></section><section className="listing-checklist"><h3>Good to know</h3><p><Check size={16} /> Clear details before you commit</p><p><Check size={16} /> Updates appear in your Me page</p><p><Check size={16} /> You can withdraw before confirmation</p></section></div>
      <div className="listing-action"><div><small>{directoryTypeLabel(item.type).toUpperCase()}</small><b>{item.tag}</b></div><button className={completed ? "completed" : ""} onClick={() => { if (completed) return; if (redeemable) setRedeeming(true); else if (item.externalUrl) window.open(item.externalUrl, "_blank", "noopener,noreferrer"); else { setCompleted(true); notify(actionMessage); } }}>{completed ? <><Check size={18} /> Done</> : <>{item.action}<ArrowRight size={18} /></>}</button></div>
      {redeeming && <RedemptionFlow mode={redemptionMode} title={item.title} externalUrl={item.externalUrl} onClose={() => setRedeeming(false)} onConsumed={() => { setCompleted(true); notify(`${directoryTypeLabel(item.type)} offer redeemed`); }} notify={notify} />}
    </div>
  );
}

function WorkWithUs({ initialTrack, onBack, onEarnings, notify, appliedCampaigns, onToggleCampaign }: { initialTrack: WorkTrack; onBack: () => void; onEarnings: () => void; notify: (message: string) => void; appliedCampaigns: Set<string>; onToggleCampaign: (campaignId: string) => void }) {
  const [track, setTrack] = useState<WorkTrack>(initialTrack);
  const [interest, setInterest] = useState<Set<string>>(() => new Set());
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [roleApplicationOpen, setRoleApplicationOpen] = useState(false);
  const [applicationNote, setApplicationNote] = useState("");
  const campaigns = [
    { id: "paragon-reel", brand: "Paragon", title: "Film a dinner-for-two Reel", pay: "₹4,500", method: "Visit the restaurant", deadline: "Apply by Aug 8", image: deals[0].image },
    { id: "beauty-unbox", brand: "Nykaa Luxe", title: "Create a beauty unboxing", pay: "₹6,000", method: "Package sent to you", deadline: "Apply by Aug 10", image: deals[7].image },
    { id: "pool-day", brand: "Kochi Marriott", title: "Capture a pool-day story", pay: "₹7,500", method: "Visit the property", deadline: "Apply by Aug 12", image: deals[6].image },
  ];
  const role = track === "bd" ? { eyebrow: "PAID INTERNSHIP", title: "BD & Sales Internship", copy: "Help find strong local partners, start conversations and learn how partnerships move from lead to launch.", image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=90", points: ["Paid, 3-month internship", "Field visits plus office days", "Training, scripts and weekly coaching"] } : track === "campus" ? { eyebrow: "STUDENT COMMUNITY", title: "Campus Ambassador", copy: "Represent Kouponly at your university, invite us into student events and help your campus discover better local perks.", image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=900&q=90", points: ["Get Kouponly involved in university activities", "Build a student community and share feedback", "Earn Gold Card access after selection"] } : { eyebrow: "PAID INTERNSHIP", title: "Marketing Internship", copy: "Help plan campaigns, create community content and learn how a fast consumer brand grows.", image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=90", points: ["Paid, 3-month internship", "Hybrid schedule in Kochi", "Real campaigns for your portfolio"] };
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId);
  const toggleInterest = (key: string) => { setInterest((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; }); notify(interest.has(key) ? "Interest withdrawn" : "Interest sent to the Kouponly team"); };
  return (
    <div className="screen work-screen">
      <button className="inline-back" onClick={onBack}><ArrowLeft size={18} /> Back</button>
      <header className="work-header"><p className="eyebrow coral-text">WORK WITH KOUPONLY</p><h2>Make your next move.</h2><p>Create for brands, learn sales, grow campaigns or represent your campus.</p></header>
      <div className="work-tabs"><button className={track === "creator" ? "active" : ""} onClick={() => setTrack("creator")}>Creator</button><button className={track === "bd" ? "active" : ""} onClick={() => setTrack("bd")}>BD & Sales</button><button className={track === "marketing" ? "active" : ""} onClick={() => setTrack("marketing")}>Marketing</button><button className={track === "campus" ? "active" : ""} onClick={() => setTrack("campus")}>Campus</button></div>
      {track === "creator" ? <>
        <section className="creator-accepted"><span><Check size={20} /></span><div><small>YOU&apos;RE AN APPROVED CREATOR</small><b>Choose campaigns that fit your style</b><p>Apply only to the briefs you genuinely want to make.</p></div></section>
        <button className="creator-earnings-card" onClick={onEarnings}><span><WalletCards size={21} /></span><div><small>CREATOR EARNINGS</small><b>₹12,500 earned</b><p>₹6,000 payout processing</p></div><ChevronRight size={18} /></button>
        <section className="creator-process"><h3>How creator work gets paid</h3><div><span><b>1</b><small>Pick & apply</small></span><i /><span><b>2</b><small>Receive or visit</small></span><i /><span><b>3</b><small>Create & submit</small></span><i /><span><b>4</b><small>Post & get paid</small></span></div><p>After approval, the brand sends a package or schedules a store visit. You make the video, send it for approval, post it and give Kouponly the final file. Payment is then released.</p></section>
        <section className="campaign-section"><div className="section-heading"><div><p className="eyebrow teal-text">AVAILABLE NOW</p><h3>Pick a campaign</h3></div><span>{campaigns.length}</span></div><div className="campaign-list">{campaigns.map((campaign) => { const applied = appliedCampaigns.has(campaign.id); return <article key={campaign.id}><img src={campaign.image} alt="" /><div><small>{campaign.brand} · {campaign.method}</small><b>{campaign.title}</b><p>{campaign.deadline}</p><span>{campaign.pay}</span><button className={applied ? "applied" : ""} onClick={() => setSelectedCampaignId(campaign.id)}>{applied ? <><Check size={15} /> View application</> : "View brief & apply"}</button></div></article>; })}</div></section>
      </> : <section className={`internship-detail ${track === "campus" ? "campus-detail" : ""}`}><img src={role.image} alt="" /><p className="eyebrow coral-text">{role.eyebrow}</p><h3>{role.title}</h3><p>{role.copy}</p>{track === "campus" && <div className="gold-card"><span>KOUPONLY</span><b>GOLD</b><small>Free food · Free experiences · Member extras</small></div>}<div>{role.points.map((point) => <span key={point}><Check size={16} />{point}</span>)}</div><button className={interest.has(track) ? "applied" : ""} onClick={() => interest.has(track) ? toggleInterest(track) : setRoleApplicationOpen(true)}>{interest.has(track) ? <><Check size={17} /> Withdraw interest</> : <>{track === "campus" ? "Apply to represent campus" : "Show interest"} <ArrowRight size={17} /></>}</button></section>}
      {selectedCampaign && <div className="redeem-overlay" role="dialog" aria-modal="true" aria-label={`${selectedCampaign.brand} campaign brief`}><div className="redeem-sheet campaign-brief-sheet"><button className="redeem-close" onClick={() => setSelectedCampaignId(null)} aria-label="Close"><X size={19} /></button><img className="campaign-brief-image" src={selectedCampaign.image} alt="" /><p className="eyebrow coral-text">{selectedCampaign.brand.toUpperCase()} · CREATOR BRIEF</p><h3>{selectedCampaign.title}</h3><p>You will receive a clear shot list and one review round. Submit the clean final video plus the approved social post.</p><ul className="utility-details"><li><Check size={15} />{selectedCampaign.method}</li><li><Check size={15} />One vertical video, 20–35 seconds</li><li><Check size={15} />Pay: {selectedCampaign.pay} after approval and posting</li><li><Check size={15} />{selectedCampaign.deadline}</li></ul><button className="redeem-primary" onClick={() => { onToggleCampaign(selectedCampaign.id); notify(appliedCampaigns.has(selectedCampaign.id) ? "Campaign application withdrawn" : `Applied to ${selectedCampaign.brand}`); setSelectedCampaignId(null); }}>{appliedCampaigns.has(selectedCampaign.id) ? "Withdraw application" : "Apply for this campaign"}</button><button className="redeem-secondary" onClick={() => setSelectedCampaignId(null)}>Not now</button></div></div>}
      {roleApplicationOpen && <div className="redeem-overlay" role="dialog" aria-modal="true" aria-label={`Apply for ${role.title}`}><form className="redeem-sheet role-application-sheet" onSubmit={(event) => { event.preventDefault(); toggleInterest(track); setRoleApplicationOpen(false); setApplicationNote(""); }}><button type="button" className="redeem-close" onClick={() => setRoleApplicationOpen(false)} aria-label="Close"><X size={19} /></button><span className="redeem-symbol"><BriefcaseBusiness size={24} /></span><p className="eyebrow coral-text">QUICK APPLICATION</p><h3>{role.title}</h3><p>Tell the team why this path fits you. Your profile details will be attached automatically.</p><label className="application-note"><span>Why are you interested?</span><textarea value={applicationNote} onChange={(event) => setApplicationNote(event.target.value)} placeholder="A short note about you, your college or relevant experience" required minLength={20} /></label><button className="redeem-primary" type="submit">Send interest</button><button className="redeem-secondary" type="button" onClick={() => setRoleApplicationOpen(false)}>Cancel</button></form></div>}
    </div>
  );
}

function MapView({ onSelect, notify }: { onSelect: (deal: Deal) => void; notify: (message: string) => void }) {
  const [mapCategory, setMapCategory] = useState("All");
  const [mapQuery, setMapQuery] = useState("");
  const [focused, setFocused] = useState<Deal>(deals[0]);
  const mapGroups = [
    { label: "All", categories: [] },
    { label: "Food", categories: ["Dining"] },
    { label: "Coffee", categories: ["Cafes"] },
    { label: "Beauty", categories: ["Beauty"] },
    { label: "Fun", categories: ["Entertainment", "Activities"] },
    { label: "Shop", categories: ["Shopping"] },
    { label: "Stays", categories: ["Staycations"] },
    { label: "Travel", categories: ["Travel"] },
  ];
  const activeGroup = mapGroups.find((group) => group.label === mapCategory) ?? mapGroups[0];
  const normalizedQuery = mapQuery.trim().toLowerCase();
  const matchingPartners = mapPartners
    .filter((deal) => (!activeGroup.categories.length || activeGroup.categories.includes(deal.category)) && (!normalizedQuery || `${deal.name} ${deal.place} ${deal.category} ${deal.offer}`.toLowerCase().includes(normalizedQuery)))
    .filter((deal, index, collection) => collection.findIndex((candidate) => candidate.name.toLowerCase() === deal.name.toLowerCase()) === index);
  const pins = matchingPartners.slice(0, 12);
  const focusedDeal = pins.find((deal) => deal.id === focused.id) ?? pins[0];
  const positions = [{ left: "15%", top: "28%" }, { left: "68%", top: "20%" }, { left: "43%", top: "42%" }, { left: "76%", top: "53%" }, { left: "22%", top: "61%" }, { left: "55%", top: "70%" }, { left: "36%", top: "18%" }, { left: "82%", top: "34%" }, { left: "12%", top: "47%" }, { left: "62%", top: "60%" }, { left: "30%", top: "75%" }, { left: "88%", top: "71%" }];
  return <div className="map-screen">
    <div className="map-toolbar">
      <div className="map-screen-title" aria-hidden="true"><span>KOUPONLY MAP</span><b>Nearby in Kochi</b></div>
      <label><Search size={18} /><input value={mapQuery} onChange={(event) => { setMapQuery(event.target.value); if (event.target.value) setMapCategory("All"); }} placeholder="Find a partner or offer in Kochi" />{mapQuery && <button onClick={() => setMapQuery("")} aria-label="Clear map search"><X size={15} /></button>}</label>
      <div>{mapGroups.map((group) => <button key={group.label} className={mapCategory === group.label ? "active" : ""} onClick={() => { setMapCategory(group.label); setMapQuery(""); }}>{group.label}</button>)}</div>
    </div>
    <div className="map-canvas">
      <img className="kochi-map" src="/kochi-map-bg.png" alt="Illustrated street map of Kochi and its backwaters" />
      <div className="map-place-labels" aria-hidden="true"><span style={{ left: "8%", top: "19%" }}>EDAPPALLY</span><span style={{ left: "58%", top: "35%" }}>KALOOR</span><span style={{ left: "19%", top: "51%" }}>PANAMPILLY NAGAR</span><span style={{ left: "45%", top: "75%" }}>VYTTILA</span></div>
      <span className="map-area-label"><MapIcon size={14} /> KOCHI · LIVE AREA</span>
      <div className="map-pins">{pins.map((deal, index) => <button key={deal.id} className={focusedDeal?.id === deal.id ? "active" : ""} style={positions[index]} onClick={() => setFocused(deal)} aria-label={`Show ${deal.name}`}><MapPin size={focusedDeal?.id === deal.id ? 28 : 23} fill="currentColor" /></button>)}</div>
      <span className="map-user-dot" aria-label="Your location"><i /></span>
      <button className="locate-me" onClick={() => { setMapCategory("All"); setMapQuery(""); setFocused(deals[2]); notify("Map centred on your location near Centre Square"); }} aria-label="Centre on my location"><Navigation size={20} /></button>
    </div>
    <div className="map-results"><div><span><small>{matchingPartners.length} PARTNERS NEARBY</small><b>{mapCategory === "All" ? "Best around you" : mapCategory}</b></span><em>{normalizedQuery ? `Results for “${mapQuery}”` : "Kochi"}</em></div>{focusedDeal ? <button className="map-preview" onClick={() => onSelect(focusedDeal)}><img src={focusedDeal.image} alt="" /><span><small>{focusedDeal.category} · {focusedDeal.distance}</small><b>{focusedDeal.name}</b><p>{focusedDeal.offer}</p><em>{focusedDeal.saving}</em></span><ChevronRight size={18} /></button> : <div className="map-empty"><MapPin size={23} /><b>No matching partners</b><p>Try another area, category or search.</p><button onClick={() => { setMapCategory("All"); setMapQuery(""); }}>Show all</button></div>}</div>
  </div>;
}

function Profile({ notify, appliedCampaigns, onCreatorHub, onAccount, onBrowseDeals, openRewards, onRewardsOpened }: { notify: (message: string) => void; appliedCampaigns: Set<string>; onCreatorHub: () => void; onAccount: (page: AccountPageKey) => void; onBrowseDeals: () => void; openRewards: boolean; onRewardsOpened: () => void }) {
  const [view, setView] = useState<"main" | "rewards">("main");
  useEffect(() => {
    document.getElementById("app-scroll")?.scrollTo({ top: 0, behavior: "auto" });
  }, [view]);
  useEffect(() => {
    if (!openRewards) return;
    setView("rewards");
    onRewardsOpened();
  }, [openRewards, onRewardsOpened]);
  const menu = [
    { icon: UserRound, label: "Personal details", page: "personal" as AccountPageKey },
    { icon: BadgePercent, label: "Savings activity", page: "savings" as AccountPageKey },
    { icon: WalletCards, label: "Creator earnings", page: "earnings" as AccountPageKey },
    { icon: Trophy, label: "Challenges & rewards", page: null },
    { icon: TicketPercent, label: "Membership", page: "membership" as AccountPageKey },
    { icon: Gift, label: "Gifts", page: "gifts" as AccountPageKey },
    { icon: Settings, label: "Preferences", page: "settings" as AccountPageKey },
    { icon: MessageCircle, label: "Help & support", page: "help" as AccountPageKey },
  ];
  if (view === "rewards") return <RewardsHub notify={notify} onBack={() => setView("main")} onBrowseDeals={onBrowseDeals} />;
  return (
    <div className="profile-screen">
      <div className="profile-hero"><div className="profile-top"><p className="eyebrow">YOUR SPACE</p><button aria-label="Settings" onClick={() => onAccount("settings")}><Settings size={19} /></button></div><div className="avatar">NJ<span /></div><h2>Neil Jose Pillard</h2><p>neil.j.pillard@gmail.com</p><div className="profile-stats"><span><b>₹2,400</b><small>saved this month</small></span><i /><span><b>8</b><small>offers enjoyed</small></span></div></div>
      <button className="streak-card" onClick={() => onAccount("savings")}><span className="streak-icon">6</span><div><small>MONTHLY STREAK</small><b>You’re on a roll</b><p>One more saving to beat July.</p></div><ChevronRight size={18} /></button>
      <button className="creator-status-card" onClick={onCreatorHub}><span className="creator-avatar"><Clapperboard size={22} /></span><span><small>KOUPONLY CREATOR · ACCEPTED</small><b>₹12,500 earned · 3 campaigns ready</b><p>{appliedCampaigns.size ? `${appliedCampaigns.size} application${appliedCampaigns.size === 1 ? "" : "s"} in progress` : "Pick the briefs that fit your style."}</p></span><ChevronRight size={18} /></button>
      <button className="profile-rewards-card" onClick={() => setView("rewards")}>
        <span className="profile-rewards-icon"><Trophy size={22} /></span>
        <span className="profile-rewards-copy"><small>CHALLENGES & REWARDS</small><b>680 points · 4 challenges active</b><p>Complete goals and redeem food, coffee or experiences.</p></span>
        <ChevronRight size={18} />
      </button>
      <div className="profile-menu">{menu.map(({ icon: Icon, label, page }) => <button key={label} onClick={() => page ? onAccount(page) : setView("rewards")}><span><Icon size={19} /></span><b>{label}</b><ChevronRight size={18} /></button>)}</div>
      <button className="sign-out" onClick={() => notify("Demo mode — you’re still signed in")}>Sign out</button>
      <p className="version">Kouponly concept · v1.0</p>
    </div>
  );
}

function DealDetail({ deal, saved, onBack, onSave, notify }: { deal: Deal; saved: boolean; onBack: () => void; onSave: () => void; notify: (message: string) => void }) {
  const offers = [deal.offer, "Complimentary dessert with two mains", "20% off your total bill"];
  const [savedOffers, setSavedOffers] = useState<Set<number>>(() => new Set());
  const [offerRedemptions, setOfferRedemptions] = useState<Record<number, number>>({});
  const [redeemingOffer, setRedeemingOffer] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const onlineOffer = ["Shopping", "Travel", "Entertainment"].includes(deal.category);
  const shareDeal = async () => {
    const shareData = { title: `${deal.name} on Kouponly`, text: `${deal.offer} — ${deal.saving}`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard?.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
      notify("Share link copied");
    } catch {
      notify("Sharing cancelled");
    }
  };
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${deal.name}, ${deal.place}, Kerala`)}`;
  return (
    <div className="detail-screen">
      <div className="detail-hero"><img src={deal.image} alt={deal.name} /><div className="detail-nav"><button onClick={onBack} aria-label="Back"><ArrowLeft size={21} /></button><div><button onClick={onSave} aria-label={saved ? "Remove from saved" : "Save offer"}><Heart size={20} fill={saved ? "currentColor" : "none"} /></button><button onClick={shareDeal} aria-label="Share"><Share2 size={20} /></button></div></div><span className="detail-tag">{deal.category}</span></div>
      <div className="detail-content"><div className="detail-heading"><div><h2>{deal.name}</h2><p><MapPin size={15} />{deal.place} · {deal.distance}</p></div><span><Star size={15} fill="currentColor" />{deal.rating}</span></div>
        <div className="action-row"><a href="tel:+914844002400"><Phone size={18} /><span>Call</span></a><a href={directionsUrl} target="_blank" rel="noreferrer"><Navigation size={18} /><span>Directions</span></a><button onClick={() => setInfoOpen(true)}><Info size={18} /><span>Info</span></button></div>
        <section className="offer-section"><div className="section-heading"><div><p className="eyebrow coral-text">MEMBER PRICES</p><h3>Available offers</h3></div><span className="offer-count">{offers.length}</span></div>{offers.map((offer, index) => { const used = offerRedemptions[index] ?? 0; const remaining = 3 - used; const expired = remaining === 0; return <article className="offer-ticket" key={offer}><span className="ticket-icon"><TicketPercent size={21} /></span><div className="offer-ticket-copy"><small>OFFER {String(index + 1).padStart(2, "0")}</small><b>{offer}</b><p>{index === 0 ? deal.saving : `Save ₹${250 + index * 150}`}</p><em>{expired ? "Expired · renews 1 Sep" : `${remaining}/3 remaining · renews 1 Sep`}</em></div><div className="offer-ticket-actions"><button className={savedOffers.has(index) ? "saved offer-save" : "offer-save"} aria-label="Save this offer" onClick={() => { setSavedOffers((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; }); notify(savedOffers.has(index) ? "Offer removed from saved" : "Offer saved"); }}><Bookmark size={17} fill={savedOffers.has(index) ? "currentColor" : "none"} /></button><button className="offer-redeem" disabled={expired} onClick={() => setRedeemingOffer(index)}>{expired ? <><X size={14} /> Expired</> : <>Redeem <ArrowRight size={14} /></>}</button></div></article>; })}</section>
        <section className="about-section"><h3>Why you’ll love it</h3><p>{deal.description}</p></section>
      </div>
      {redeemingOffer !== null && <RedemptionFlow mode={onlineOffer ? "online" : "inStore"} title={`${deal.name} · ${offers[redeemingOffer]}`} externalUrl={onlineOffer ? "https://www.google.com/search?q=" + encodeURIComponent(deal.name + " Kerala") : undefined} onClose={() => setRedeemingOffer(null)} onConsumed={() => { setOfferRedemptions((current) => ({ ...current, [redeemingOffer]: Math.min(3, (current[redeemingOffer] ?? 0) + 1) })); notify("Offer redeemed successfully"); }} notify={notify} />}
      {infoOpen && <div className="redeem-overlay" role="dialog" aria-modal="true" aria-label={`${deal.name} information`}><div className="redeem-sheet utility-sheet"><button className="redeem-close" onClick={() => setInfoOpen(false)} aria-label="Close"><X size={19} /></button><span className="redeem-symbol"><Info size={24} /></span><p className="eyebrow coral-text">PARTNER INFORMATION</p><h3>{deal.name}</h3><p>{deal.description}</p><ul className="utility-details"><li><MapPin size={15} />{deal.place}</li><li><Star size={15} />{deal.rating} member rating</li><li><TicketPercent size={15} />Offers renew on 1 September</li></ul><a className="redeem-primary utility-link" href={directionsUrl} target="_blank" rel="noreferrer">Open directions <ArrowRight size={17} /></a><button className="redeem-secondary" onClick={() => setInfoOpen(false)}>Close</button></div></div>}
    </div>
  );
}

function RedemptionFlow({ mode, title, externalUrl, onClose, onConsumed, notify }: { mode: "online" | "inStore"; title: string; externalUrl?: string; onClose: () => void; onConsumed: () => void; notify: (message: string) => void }) {
  const [step, setStep] = useState<"warning" | "pin" | "code" | "success">(mode === "online" ? "warning" : "pin");
  const [pin, setPin] = useState("");
  const [seconds, setSeconds] = useState(600);
  const code = `KPL-${title.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase()}-${String(title.length * 137).slice(-4).padStart(4, "0")}`;
  useEffect(() => {
    if (step !== "code") return;
    const timer = window.setInterval(() => setSeconds((current) => current > 0 ? current - 1 : 0), 1000);
    return () => window.clearInterval(timer);
  }, [step]);
  const useOnlineOffer = () => { setStep("code"); onConsumed(); };
  const verifyPartner = () => { if (pin.length !== 4) return; setStep("success"); onConsumed(); };
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainingSeconds = String(seconds % 60).padStart(2, "0");
  return <div className="redeem-overlay" role="dialog" aria-modal="true" aria-label="Redeem offer"><div className="redeem-sheet"><button className="redeem-close" onClick={onClose} aria-label="Close"><X size={19} /></button>{step === "warning" && <><span className="redeem-symbol"><Info size={25} /></span><p className="eyebrow coral-text">ONLINE REDEMPTION</p><h3>Use this offer now?</h3><p>Once you continue, one redemption is used and cannot be restored. Only proceed when you are ready to complete your booking or purchase.</p><div className="redeem-warning"><TicketPercent size={18} /><span><b>{title}</b><small>Your code will stay active for 10 minutes.</small></span></div><button className="redeem-primary" onClick={useOnlineOffer}>Yes, reveal my code</button><button className="redeem-secondary" onClick={onClose}>Not yet</button></>}{step === "pin" && <><span className="redeem-symbol vendor"><Store size={25} /></span><p className="eyebrow coral-text">IN-STORE REDEMPTION</p><h3>Hand this phone to the partner</h3><p>A partner staff member must enter their four-digit Kouponly PIN. Do not enter a code yourself.</p><label className="vendor-pin"><span>PARTNER PIN</span><input autoFocus inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" /></label><button className="redeem-primary" disabled={pin.length !== 4} onClick={verifyPartner}>Verify and redeem</button><button className="redeem-secondary" onClick={onClose}>Cancel</button></>}{step === "code" && <><span className="redeem-symbol success"><Check size={25} /></span><p className="eyebrow teal-text">CODE ACTIVE</p><h3>Complete it in {minutes}:{remainingSeconds}</h3><p>Copy the code, open the partner website and follow its checkout instructions. Enter the code before the timer ends.</p><button className="active-code" onClick={() => { navigator.clipboard?.writeText(code); notify("Redemption code copied"); }}><small>TAP TO COPY</small><b>{seconds ? code : "CODE EXPIRED"}</b></button><ol><li>Open the partner website.</li><li>Choose the eligible item or time.</li><li>Enter this code at checkout.</li></ol>{externalUrl && <button className="redeem-primary" disabled={!seconds} onClick={() => window.open(externalUrl, "_blank", "noopener,noreferrer")}>Open partner website <ArrowRight size={17} /></button>}<button className="redeem-secondary" onClick={onClose}>Done</button></>}{step === "success" && <><span className="redeem-symbol success"><Check size={25} /></span><p className="eyebrow teal-text">REDEEMED</p><h3>Partner PIN accepted</h3><p>One redemption has been used and added to your activity. Enjoy your visit to {title}.</p><button className="redeem-primary" onClick={onClose}>Done</button></>}</div></div>;
}

function UtilityDialog({ data, onClose }: { data: UtilityDialogData; onClose: () => void }) {
  const external = Boolean(data.primaryHref?.startsWith("http"));
  return <div className="redeem-overlay utility-overlay" role="dialog" aria-modal="true" aria-label={data.title} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="redeem-sheet utility-sheet">
      <button className="redeem-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
      <span className="redeem-symbol"><Info size={24} /></span>
      <p className="eyebrow coral-text">{data.eyebrow}</p>
      <h3>{data.title}</h3>
      <p>{data.body}</p>
      {data.details && <ul className="utility-details">{data.details.map((detail) => <li key={detail}><Check size={15} />{detail}</li>)}</ul>}
      {data.primaryHref && <a className="redeem-primary utility-link" href={data.primaryHref} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{data.primaryLabel ?? "Continue"}<ArrowRight size={17} /></a>}
      <button className={data.primaryHref ? "redeem-secondary" : "redeem-primary"} onClick={onClose}>{data.primaryHref ? "Close" : "Done"}</button>
    </div>
  </div>;
}
