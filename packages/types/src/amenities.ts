export interface AmenityDefinition {
  id: string;
  name: string;
  category: 'Connectivity' | 'Utilities' | 'Security' | 'Appliance' | 'Climate' | 'Facility' | 'Room' | 'Service' | 'Wellness' | 'Entertainment';
  icon: string;
}

export const STANDARD_AMENITIES_CATALOG: readonly AmenityDefinition[] = [
  { id: 'wifi', name: 'High-Speed Wi-Fi', category: 'Connectivity', icon: 'Wifi' },
  { id: 'power_backup', name: 'Power Backup / Inverter', category: 'Utilities', icon: 'Zap' },
  { id: 'cctv', name: 'CCTV Surveillance', category: 'Security', icon: 'Shield' },
  { id: 'security_guard', name: '24/7 Security Guard', category: 'Security', icon: 'UserCheck' },
  { id: 'laundry', name: 'Washing Machine / Laundry', category: 'Appliance', icon: 'Shirt' },
  { id: 'ac', name: 'Air Conditioning (AC)', category: 'Climate', icon: 'Wind' },
  { id: 'geyser', name: 'Hot Water / Geyser', category: 'Utilities', icon: 'Flame' },
  { id: 'parking', name: 'Car & Bike Parking', category: 'Facility', icon: 'Car' },
  { id: 'elevator', name: 'Elevator / Lift', category: 'Facility', icon: 'ArrowUpDown' },
  { id: 'ro_water', name: 'RO Purified Drinking Water', category: 'Utilities', icon: 'Droplet' },
  { id: 'attached_bathroom', name: 'Attached Bathroom', category: 'Room', icon: 'Bath' },
  { id: 'kitchen', name: 'Common Kitchen / Induction', category: 'Facility', icon: 'Utensils' },
  { id: 'housekeeping', name: 'Daily Housekeeping', category: 'Service', icon: 'Sparkles' },
  { id: 'gym', name: 'Gym / Fitness Room', category: 'Wellness', icon: 'Dumbbell' },
  { id: 'refrigerator', name: 'Refrigerator / Fridge', category: 'Appliance', icon: 'Box' },
  { id: 'tv', name: 'Smart TV / Entertainment', category: 'Entertainment', icon: 'Tv' },
] as const;
