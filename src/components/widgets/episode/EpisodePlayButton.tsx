import Btn from '@/components/ui/Btn'
import { useTypeSafeTranslations } from '@/hooks/useTypeSafeTranslations'
import { mergeClasses } from '@/lib/merge-classes'

interface EpisodePlayButtonProps {
  label: string
  isPlaying: boolean
  isFinished?: boolean
  loading?: boolean
  onClick: (e: React.MouseEvent) => void
  className?: string
}

export default function EpisodePlayButton({ label, isPlaying, isFinished = false, loading = false, onClick, className }: EpisodePlayButtonProps) {
  const t = useTypeSafeTranslations()

  return (
    <Btn
      color="bg-transparent"
      loading={loading}
      ariaLabel={`${isPlaying ? t('ButtonPause') : t('ButtonPlay')}, ${label}`}
      onClick={onClick}
      className={mergeClasses('border-foreground/20 hover:bg-foreground/10 flex-nowrap px-2', isFinished ? 'text-foreground/40' : 'text-foreground', className)}
    >
      <span className={mergeClasses('material-symbols fill text-xl sm:text-2xl', isPlaying ? '' : 'text-success')} aria-hidden="true">
        {isPlaying ? 'pause' : 'play_arrow'}
      </span>
      <span className="pe-1 text-xs font-semibold whitespace-nowrap sm:text-sm">{label}</span>
    </Btn>
  )
}
