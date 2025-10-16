'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';
import { useState } from 'react';

export function AddPlayerDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Player
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Player</DialogTitle>
          <DialogDescription>
            Enter the details for the new player. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" defaultValue="New Player" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="position" className="text-right">
              Position
            </Label>
            <Select>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEL">DEL (Forward)</SelectItem>
                <SelectItem value="MED">MED (Midfielder)</SelectItem>
                <SelectItem value="DEF">DEF (Defender)</SelectItem>
                <SelectItem value="POR">POR (Goalkeeper)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid grid-cols-2 items-center gap-2">
                <Label htmlFor="pac">PAC</Label>
                <Input id="pac" type="number" defaultValue="75" />
            </div>
             <div className="grid grid-cols-2 items-center gap-2">
                <Label htmlFor="sho">SHO</Label>
                <Input id="sho" type="number" defaultValue="75" />
            </div>
             <div className="grid grid-cols-2 items-center gap-2">
                <Label htmlFor="pas">PAS</Label>
                <Input id="pas" type="number" defaultValue="75" />
            </div>
             <div className="grid grid-cols-2 items-center gap-2">
                <Label htmlFor="dri">DRI</Label>
                <Input id="dri" type="number" defaultValue="75" />
            </div>
             <div className="grid grid-cols-2 items-center gap-2">
                <Label htmlFor="def">DEF</Label>
                <Input id="def" type="number" defaultValue="75" />
            </div>
             <div className="grid grid-cols-2 items-center gap-2">
                <Label htmlFor="phy">PHY</Label>
                <Input id="phy" type="number" defaultValue="75" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={() => setOpen(false)}>Save Player</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
