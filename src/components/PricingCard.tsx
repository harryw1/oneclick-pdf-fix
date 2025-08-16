'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PricingPlan {
  name: string;
  price: number;
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
  stripePriceId?: string;
}

interface PricingCardProps {
  plan: PricingPlan;
  onSelectPlan: (priceId?: string) => void;
  className?: string;
  animationDelay?: number;
}

export default function PricingCard({ plan, onSelectPlan, className, animationDelay = 0 }: PricingCardProps) {
  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-xl animate-slide-up",
        plan.popular && "ring-2 ring-primary scale-105 shadow-2xl",
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {plan.popular && (
        <div className="absolute top-0 right-0 bg-gradient-to-l from-primary-500 to-primary-600 text-white text-xs font-bold px-4 py-2 rounded-bl-lg">
          <div className="flex items-center space-x-1">
            <Zap className="h-3 w-3" />
            <span>MOST POPULAR</span>
          </div>
        </div>
      )}
      
      <CardHeader className={cn(
        "text-center pb-8",
        plan.popular && "bg-gradient-to-b from-primary-500/5 to-transparent"
      )}>
        <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
        <div className="mt-4">
          <span className="text-5xl font-bold">${plan.price}</span>
          <span className="text-muted-foreground ml-1">/month</span>
        </div>
        <p className="text-muted-foreground mt-2">{plan.description}</p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <ul className="space-y-4">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
        
        <Button 
          onClick={() => onSelectPlan(plan.stripePriceId)}
          className={cn(
            "w-full h-12 text-base font-semibold transition-all duration-200",
            plan.popular && "bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-lg hover:shadow-xl"
          )}
          variant={plan.popular ? "default" : "outline"}
        >
          {plan.cta}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}