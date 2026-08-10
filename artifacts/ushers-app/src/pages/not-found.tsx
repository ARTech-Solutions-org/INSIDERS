import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center brand-grid px-4">
      <Card className="w-full max-w-md mx-4 bg-card border-card-border rounded-3xl shadow-xl">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-secondary" />
            <h1 className="brand-display text-3xl text-foreground">
              Page not found
            </h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            This page slipped off the call sheet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
