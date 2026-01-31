// Similar activities grouped together – "walk in nature" and "hiking" both match
const STATUS_KEYWORD_GROUPS = [
  ['walk', 'stroll', 'wander', 'hike', 'hiking', 'trail', 'nature', 'outdoor', 'outside', 'fresh air', 'woods', 'forest', 'park', 'nature walk'],
  ['run', 'jog'],
  ['coffee', 'cafe', 'tea'],
  ['drink', 'bar', 'beer', 'wine'],
  ['eat', 'food', 'lunch', 'dinner', 'brunch'],
  ['cook', 'baking', 'bake'],
  ['read', 'book'],
  ['movie', 'film', 'cinema'],
  ['music', 'concert', 'gig'],
  ['game', 'gaming', 'play'],
  ['bike', 'cycling', 'cycle'],
  ['swim', 'beach', 'pool'],
  ['yoga', 'gym', 'workout', 'exercise'],
  ['travel', 'trip', 'explore'],
  ['art', 'museum', 'gallery', 'painting', 'workshop', 'craft', 'pottery', 'draw'],
  ['chat', 'talk', 'hang', 'catch up'],
  ['study', 'focus'],
  ['work'],
  ['dog', 'pet', 'puppy'],
  ['dance', 'party'],
]

// Map status keywords to related interest IDs. Values can be string or string[] so
// one activity (e.g. "painting class") matches multiple interests (e.g. "art", "painting").
const STATUS_TO_INTEREST = {
  hike: 'outdoor',
  hiking: 'hiking',
  trail: 'outdoor',
  walk: 'outdoor',
  stroll: 'outdoor',
  nature: 'outdoor',
  outdoor: 'outdoor',
  outside: 'outdoor',
  forest: 'outdoor',
  woods: 'outdoor',
  park: 'outdoor',
  run: 'sports',
  jog: 'sports',
  bike: 'outdoor',
  cycling: 'outdoor',
  swim: 'sports',
  beach: 'travel',
  yoga: 'sports',
  gym: 'sports',
  workout: 'sports',
  exercise: 'sports',
  art: ['art', 'painting'],       // "art class" matches interest "art" or "painting"
  museum: 'art',
  gallery: 'art',
  painting: ['painting', 'art'],  // "painting class" matches interest "art" or "painting"
  draw: ['painting', 'art'],
  workshop: ['crafts', 'art'],
  craft: 'crafts',
  pottery: 'crafts',
  cooking: 'cooking',
  cook: 'cooking',
  baking: 'cooking',
  read: 'reading',
  book: 'reading',
  movie: 'movies',
  film: 'movies',
  cinema: 'movies',
  music: 'music',
  concert: 'music',
  gaming: 'gaming',
  game: 'gaming',
  travel: 'travel',
  trip: 'travel',
  photography: 'photography',
  tech: 'tech',
}

function getKeywordsForStatus(status) {
  if (!status || typeof status !== 'string') return []
  const lower = status.toLowerCase()
  for (const keywords of STATUS_KEYWORD_GROUPS) {
    if (keywords.some((k) => lower.includes(k))) return keywords
  }
  return []
}

function statusSimilarity(statusA, statusB) {
  const kwA = new Set(getKeywordsForStatus(statusA))
  const kwB = new Set(getKeywordsForStatus(statusB))
  if (kwA.size === 0 && kwB.size === 0) return 0
  if (kwA.size === 0 || kwB.size === 0) return 0
  const overlap = [...kwA].filter((k) => kwB.has(k)).length
  return overlap > 0 ? overlap / Math.max(kwA.size, kwB.size) : 0
}

function interestOverlap(interestsA, interestsB) {
  const a = new Set(Array.isArray(interestsA) ? interestsA : [])
  const b = new Set(Array.isArray(interestsB) ? interestsB : [])
  if (a.size === 0 && b.size === 0) return 0
  if (a.size === 0 || b.size === 0) return 0
  const overlap = [...a].filter((x) => b.has(x)).length
  return overlap / Math.max(a.size, b.size)
}

// Status keywords (e.g. "painting class") match related interests (e.g. "art", "painting")
function statusInterestOverlap(status, interests) {
  if (!status || typeof status !== 'string') return 0
  const interestsSet = new Set(Array.isArray(interests) ? interests : [])
  if (interestsSet.size === 0) return 0
  const lower = status.toLowerCase()
  for (const [keyword, mapped] of Object.entries(STATUS_TO_INTEREST)) {
    if (!lower.includes(keyword)) continue
    const ids = Array.isArray(mapped) ? mapped : [mapped]
    if (ids.some((id) => interestsSet.has(id))) return 0.8
  }
  return 0
}

export function scoreMatch(myProfile, candidate) {
  const myStatus = myProfile?.status?.trim() || ''
  const myInterests = Array.isArray(myProfile?.interests) ? myProfile.interests : []
  const candStatus = candidate?.status?.trim() || ''
  const candInterests = Array.isArray(candidate?.interests) ? candidate.interests : []

  const statusSim = statusSimilarity(myStatus, candStatus)
  const interestSim = interestOverlap(myInterests, candInterests)
  // Cross-match: my status "hiking" ↔ their interest "outdoor" (and vice versa)
  const statusInterestSim = Math.max(
    statusInterestOverlap(myStatus, candInterests),
    statusInterestOverlap(candStatus, myInterests)
  )

  const bothHaveStatus = Boolean(myStatus) && Boolean(candStatus)
  const eitherHasStatus = Boolean(myStatus) || Boolean(candStatus)

  if (bothHaveStatus) return Math.max(statusSim * 0.6 + interestSim * 0.4, statusInterestSim)
  if (eitherHasStatus) return Math.max(interestSim * 0.9, statusInterestSim)
  return interestSim > 0 ? interestSim : statusInterestSim || 0.05
}

// Derive group name from shared activity (e.g. walk/nature/hiking -> "Hiking Group")
export function getGroupNameForMatch(profile, matches) {
  const status = (profile?.status || '').toLowerCase()
  const hiking = ['hike', 'hiking', 'trail', 'walk', 'nature', 'stroll', 'wander']
  const art = ['painting', 'art', 'draw', 'museum', 'gallery', 'workshop', 'craft']
  if (hiking.some((k) => status.includes(k))) return 'Hiking Group'
  if (art.some((k) => status.includes(k))) return 'Art & Painting Group'
  if (status) return status.slice(0, 30) + (status.length > 30 ? '…' : '')
  return 'Meetup'
}

export function findBestMatches(myProfile, candidates, maxCount = 5) {
  return candidates
    .filter((c) => c.id !== myProfile?.id)
    .map((c) => ({ user: c, score: scoreMatch(myProfile, c) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map((x) => x.user)
}
