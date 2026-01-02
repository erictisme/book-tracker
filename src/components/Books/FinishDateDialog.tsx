import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';

interface FinishDateDialogProps {
  open: boolean;
  bookTitle: string;
  dateAdded?: string; // ISO date string - used to default to 1 month after
  onConfirm: (date: string | null) => void; // null = use current date
  onCancel: () => void;
}

const months = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

// Generate years from 2010 to current year
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 2009 }, (_, i) => currentYear - i);

export function FinishDateDialog({ open, bookTitle, dateAdded, onConfirm, onCancel }: FinishDateDialogProps) {
  // Default to 1 month after date_added, or current date if no date_added
  const defaultDate = useMemo(() => {
    if (dateAdded) {
      // Handle various date formats (ISO, timestamp, etc.)
      const added = new Date(dateAdded);
      if (!isNaN(added.getTime())) {
        added.setMonth(added.getMonth() + 1);
        // Cap at current date (don't suggest future dates)
        const now = new Date();
        if (added > now) {
          return now;
        }
        return added;
      }
    }
    return new Date();
  }, [dateAdded]);

  const [month, setMonth] = useState(String(defaultDate.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(defaultDate.getFullYear()));

  // Reset to default when dialog opens with new dateAdded
  useEffect(() => {
    if (open) {
      setMonth(String(defaultDate.getMonth() + 1).padStart(2, '0'));
      setYear(String(defaultDate.getFullYear()));
    }
  }, [open, defaultDate]);

  const handleConfirm = () => {
    // Create date as last day of the month (since we only have month/year)
    const date = `${year}-${month}-15`; // Use mid-month as a reasonable default
    onConfirm(date);
  };

  const handleSkip = () => {
    onConfirm(null); // Will use current date
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">When did you finish?</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground truncate" title={bookTitle}>
          {bookTitle}
        </p>

        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-24">
            <Label className="text-xs text-muted-foreground">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Just now
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
