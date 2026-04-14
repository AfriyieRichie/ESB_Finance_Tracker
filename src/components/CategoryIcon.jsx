import {
  Home, Utensils, Car, Film, Heart, ShoppingBag, Zap,
  BookOpen, Sparkles, Package, Briefcase, TrendingUp,
  Landmark, Building2, Laptop, Shield, BarChart2, Bitcoin,
} from 'lucide-react';

const CATEGORY_ICONS = {
  'Housing':        Home,
  'Food & Dining':  Utensils,
  'Transportation': Car,
  'Entertainment':  Film,
  'Healthcare':     Heart,
  'Shopping':       ShoppingBag,
  'Utilities':      Zap,
  'Education':      BookOpen,
  'Personal Care':  Sparkles,
  'Other':          Package,
  'Salary':         Briefcase,
  'Dividend':       TrendingUp,
  'Interest':       Landmark,
  'Business':       Building2,
  'Freelance':      Laptop,
  'Rental':         Home,
  'Others':         Package,
  'Emergency Fund': Shield,
  'Stock Portfolio':BarChart2,
  'Pension Fund':   Briefcase,
  'Fixed Deposit':  Landmark,
  'Cryptocurrency': Bitcoin,
  'Real Estate':    Home,
  'Mutual Funds':   TrendingUp,
};

// Icons are always neutral white — the ring/container carries the colour
export default function CategoryIcon({ name, size = 18 }) {
  const Icon = CATEGORY_ICONS[name] || Package;
  return <Icon size={size} strokeWidth={1.5} color="#c8ddd5" />;
}
