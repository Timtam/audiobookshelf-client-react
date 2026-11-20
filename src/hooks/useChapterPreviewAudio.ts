'use client'

import { withBasePath } from '@/lib/basePath'
import { getAudioTrackForTime } from '@/lib/chapters/chapterEditorUtils'
import type { AudioTrack } from '@/types/api'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Library file URLs are `/api/items/:id/file/:ino`. Preview them through the cookie-authenticated media proxy. */
function chapterPreviewPath(contentUrl: string) {
  if (contentUrl.startsWith('/api/items/') && contentUrl.includes('/file/')) {
    return `${contentUrl.replace(/^\/api\//, '/internal-api/')}/media`
  }
  return contentUrl
}

interface UseChapterPreviewAudioOptions {
  tracks: AudioTrack[]
}

export function useChapterPreviewAudio({ tracks }: UseChapterPreviewAudioOptions) {
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playStartTimeRef = useRef<number | null>(null)
  const tracksRef = useRef(tracks)
  tracksRef.current = tracks

  const [selectedChapterId, setSelectedChapterId] = useState<number | string | null>(null)
  const [isPlayingChapter, setIsPlayingChapter] = useState(false)
  const [isLoadingChapter, setIsLoadingChapter] = useState(false)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)

  const stopElapsedTimeTracking = useCallback(() => {
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current)
      elapsedIntervalRef.current = null
    }
    setElapsedTime(0)
    playStartTimeRef.current = null
  }, [])

  const removeAudioEl = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.removeAttribute('src')
      audioElRef.current.load()
      audioElRef.current.remove()
      audioElRef.current = null
    }
  }, [])

  /** Stops the preview. The audio element stays, so that another chapter of the same file plays without loading the file again. */
  const stopChapter = useCallback(() => {
    audioElRef.current?.pause()
    setSelectedChapterId(null)
    setIsPlayingChapter(false)
    setIsLoadingChapter(false)
    stopElapsedTimeTracking()
  }, [stopElapsedTimeTracking])

  const destroyAudioEl = useCallback(() => {
    removeAudioEl()
    stopChapter()
  }, [removeAudioEl, stopChapter])

  const startElapsedTimeTracking = useCallback(() => {
    if (elapsedIntervalRef.current) return

    setElapsedTime(0)
    playStartTimeRef.current = Date.now()
    elapsedIntervalRef.current = setInterval(() => {
      if (playStartTimeRef.current) {
        setElapsedTime(Math.floor((Date.now() - playStartTimeRef.current) / 1000))
      }
    }, 100)
  }, [])

  const playTrackAtTime = useCallback(
    (audioTrack: AudioTrack, trackOffset: number, continueChapterPlayback = false) => {
      setCurrentTrackIndex(audioTrack.index)
      if (!continueChapterPlayback) {
        setIsLoadingChapter(true)
      }

      const src = withBasePath(chapterPreviewPath(audioTrack.contentUrl))
      const startPlayback = (audioEl: HTMLAudioElement) => {
        audioEl.currentTime = trackOffset
        void audioEl.play()
      }

      // For the file of the last preview the browser only has to seek. A new element would load the index
      // of the file again, which is several megabytes for a long m4b file and takes seconds on a slow connection.
      const loadedAudioEl = audioElRef.current
      if (loadedAudioEl?.getAttribute('src') === src && loadedAudioEl.readyState >= HTMLMediaElement.HAVE_METADATA) {
        startPlayback(loadedAudioEl)
        return
      }
      removeAudioEl()

      const audioEl = document.createElement('audio')
      audioEl.src = src
      audioEl.id = 'chapter-audio'
      document.body.appendChild(audioEl)
      audioElRef.current = audioEl

      const handlePlay = () => {
        setIsLoadingChapter(false)
        setIsPlayingChapter(true)
        startElapsedTimeTracking()
      }

      const handleEnded = () => {
        const nextTrack = tracksRef.current.find((t) => t.index === audioTrack.index + 1)
        if (audioElRef.current) {
          audioElRef.current.remove()
          audioElRef.current = null
        }
        if (nextTrack) {
          playTrackAtTime(nextTrack, 0, true)
        } else {
          destroyAudioEl()
        }
      }

      // Seeking only needs the metadata. Waiting for audio data would load the start of the file first.
      audioEl.addEventListener('loadedmetadata', () => startPlayback(audioEl), { once: true })
      audioEl.addEventListener('play', handlePlay)
      audioEl.addEventListener('ended', handleEnded, { once: true })
    },
    [destroyAudioEl, removeAudioEl, startElapsedTimeTracking]
  )

  const playChapter = useCallback(
    (chapterId: number | string, chapterStart: number) => {
      if (selectedChapterId === chapterId) {
        if (isLoadingChapter) return
        if (isPlayingChapter) {
          stopChapter()
          return
        }
      }

      if (selectedChapterId !== null) {
        stopChapter()
      }

      const audioTrack = getAudioTrackForTime(tracks, chapterStart)
      if (!audioTrack) {
        return
      }

      setSelectedChapterId(chapterId)
      playTrackAtTime(audioTrack, chapterStart - audioTrack.startOffset)
    },
    [isLoadingChapter, isPlayingChapter, playTrackAtTime, selectedChapterId, stopChapter, tracks]
  )

  useEffect(() => {
    return () => {
      destroyAudioEl()
    }
  }, [destroyAudioEl])

  return {
    selectedChapterId,
    isPlayingChapter,
    isLoadingChapter,
    currentTrackIndex,
    elapsedTime,
    playChapter,
    destroyAudioEl,
    getAudioTrackForTime: (time: number) => getAudioTrackForTime(tracks, time)
  }
}
