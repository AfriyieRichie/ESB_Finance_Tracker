import {
  Home, Utensils, Car, Film, Heart, ShoppingBag, Zap,
  BookOpen, Sparkles, Package, Briefcase, TrendingUp,
  Landmark, Building2, Laptop, Shield, BarChart2, Bitcoin,
  CreditCard, Lock, Users, PieChart, Smartphone, Banknote, Wallet,
} from 'lucide-react';

const CATEGORY_ICONS = {
  // Expense
  'Housing':        Home,
  'Food & Dining':  Utensils,
  'Transportation': Car,
  'Entertainment':  Film,
  'Healthcare':     Heart,
  'Shopping':       ShoppingBag,
  'Utilities':      Zap,
  'Education':      BookOpen,
  'Personal Care':  Sparkles,
  'Debt Repayment': CreditCard,
  'Other':          Package,
  // Income
  'Salary':         Briefcase,
  'Dividend':       TrendingUp,
  'Interest':       Landmark,
  'Business':       Building2,
  'Freelance':      Laptop,
  'Rental':         Home,
  'Others':         Package,
  // Savings
  'Emergency Fund':  Shield,
  'Stock Portfolio': BarChart2,
  'Pension Fund':    Briefcase,
  'Fixed Deposit':   Landmark,
  'Cryptocurrency':  Bitcoin,
  'Real Estate':     Home,
  'Mutual Funds':    TrendingUp,
};

export const ACCOUNT_TYPE_ICONS = {
  bank:   Building2,
  momo:   Smartphone,
  cash:   Banknote,
  wallet: Wallet,
  other:  CreditCard,
};

export const ASSET_TYPE_ICONS = {
  tbill:      TrendingUp,
  fixed:      Lock,
  susu:       Users,
  property:   Home,
  crypto:     Bitcoin,
  stocks:     BarChart2,
  mutualfund: PieChart,
  other:      Package,
};

const ACCENT = '#c8ddd5';

export default function CategoryIcon({ name, size = 18 }) {
  const Icon = CATEGORY_ICONS[name] || Package;
  return <Icon size={size} strokeWidth={1.5} color={ACCENT} />;
}
