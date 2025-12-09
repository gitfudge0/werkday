import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'

interface HeroCardProps {
  className?: string
}

export function HeroCard({ className }: HeroCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-primary/20 p-6',
        className
      )}
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-purple-900/30 to-pink-900/20" />
      
      {/* Animated gradient orb */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-orange-500/30 via-pink-500/20 to-violet-500/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-gradient-to-tr from-violet-500/20 to-blue-500/10 blur-2xl" />

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary">AI Powered</span>
        </div>
        
        <h2 className="mt-4 text-2xl font-bold text-foreground">
          Work Intelligence
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Empowering productivity with AI-driven insights
        </p>

        {/* Decorative element - wave/abstract shape */}
        <div className="mt-6 flex justify-center">
          <svg
            viewBox="0 0 200 100"
            className="h-24 w-48 opacity-80"
          >
            <defs>
              <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <path
              d="M0,50 Q25,20 50,50 T100,50 T150,50 T200,50 L200,100 L0,100 Z"
              fill="url(#waveGradient)"
              opacity="0.6"
            />
            <path
              d="M0,60 Q30,30 60,60 T120,60 T180,60 L200,100 L0,100 Z"
              fill="url(#waveGradient)"
              opacity="0.4"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
