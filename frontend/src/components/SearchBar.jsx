import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function SearchBar({ className, placeholder = "Enter an address to see if a 3D tour is available" }) {
  const [address, setAddress] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;
    navigate(`/tour?address=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("flex gap-2", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={placeholder}
          className="pl-12 h-14 text-base border-border/60 shadow-sm"
        />
      </div>
      <Button type="submit" className="h-14 px-8 text-base">
        Search
      </Button>
    </form>
  );
}