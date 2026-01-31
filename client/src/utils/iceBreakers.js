import { INTEREST_OPTIONS } from '../constants/interests'
import { LANGUAGE_OPTIONS } from '../constants/profile'

function getInterestLabel(id) {
  return INTEREST_OPTIONS.find((o) => o.id === id)?.label ?? id
}

function getLanguageLabel(id) {
  return LANGUAGE_OPTIONS.find((o) => o.id === id)?.label ?? id
}

/** Generate ice breaker questions based on the other person's profile */
export function getIceBreakerQuestions(profile, seed = Date.now()) {
  const questions = []
  if (!profile) return questions

  const name = profile.full_name?.trim() || 'they'
  const firstName = name.split(/\s+/)[0] || name
  
  // Simple seeded random for variety
  const random = (max) => {
    seed = (seed * 9301 + 49297) % 233280
    return (seed / 233280) * max
  }
  const pick = (arr) => arr[Math.floor(random(arr.length))]

  // Based on status ("What do you wanna do?")
  if (profile.status?.trim()) {
    const status = profile.status.trim()
    const statusOpeners = [
      `I saw you're into "${status}" — that sounds fun! Want to chat about it?`,
      `"${status}" — nice! Tell me more about that!`,
      `Noticed your status: "${status}". How'd you get into that?`,
    ]
    questions.push(pick(statusOpeners))
    
    if (/walk|stroll|hike/i.test(status)) {
      questions.push(pick([
        `Any favorite walking spots around here?`,
        `Do you prefer morning or evening walks?`,
        `Ever hiked any trails nearby?`,
      ]))
    }
    if (/coffee|tea|cafe/i.test(status)) {
      questions.push(pick([
        `What's your go-to coffee order?`,
        `Know any good cafes around here?`,
        `Are you more of a coffee or tea person?`,
      ]))
    }
    if (/badminton|tennis|sport|game|play/i.test(status)) {
      questions.push(pick([
        `I'd love to play sometime! Are you free this week?`,
        `How long have you been playing?`,
        `Do you play competitively or just for fun?`,
      ]))
    }
    if (/read|book/i.test(status)) {
      questions.push(pick([
        `What are you reading right now?`,
        `Fiction or non-fiction?`,
        `Any book recommendations?`,
      ]))
    }
    if (/music|concert/i.test(status)) {
      questions.push(pick([
        `What kind of music are you into?`,
        `Been to any good concerts lately?`,
        `Who's your favorite artist right now?`,
      ]))
    }
    if (/travel|explore|trip/i.test(status)) {
      questions.push(pick([
        `Have you been anywhere cool lately?`,
        `What's the best place you've visited?`,
        `Any upcoming trips planned?`,
      ]))
    }
    if (/cook|baking|food/i.test(status)) {
      questions.push(pick([
        `What's your signature dish?`,
        `Do you follow recipes or improvise?`,
        `What's the last thing you cooked?`,
      ]))
    }
    if (/movie|film/i.test(status)) {
      questions.push(pick([
        `Seen any good movies recently?`,
        `What's your all-time favorite film?`,
        `Are you into series or movies more?`,
      ]))
    }
  }

  // Based on interests
  const interests = Array.isArray(profile.interests) ? profile.interests : []
  interests.slice(0, 3).forEach((id) => {
    const label = getInterestLabel(id)
    const interestQuestions = {
      sports: [
        `Do you follow any sports? I'm always looking for someone to play with!`,
        `What sports do you play or watch?`,
        `Ever been to a live game?`,
      ],
      music: [
        `What kind of music do you like?`,
        `Do you play any instruments?`,
        `What's on your playlist right now?`,
      ],
      reading: [
        `What's the last book you couldn't put down?`,
        `Do you have a favorite genre?`,
        `Any authors you'd recommend?`,
      ],
      cooking: [
        `What's your favorite thing to cook?`,
        `Do you experiment with new recipes?`,
        `What's your go-to comfort food?`,
      ],
      travel: [
        `What's the best place you've traveled to?`,
        `Do you prefer beach or mountain destinations?`,
        `Any dream destinations on your list?`,
      ],
      gaming: [
        `What games have you been playing lately?`,
        `PC, console, or mobile?`,
        `Favorite game of all time?`,
      ],
      photography: [
        `Do you have a favorite subject to photograph?`,
        `What kind of camera do you use?`,
        `Ever done any street photography?`,
      ],
      outdoor: [
        `Any outdoor activities you're into?`,
        `Do you camp or prefer day trips?`,
        `What's your favorite season for outdoor stuff?`,
      ],
      art: [
        `What kind of art do you like to create or appreciate?`,
        `Do you visit galleries or museums?`,
        `Who's your favorite artist?`,
      ],
      painting: [
        `What kind of art do you like to create or appreciate?`,
        `Watercolor, acrylic, or oil?`,
        `Do you paint from life or imagination?`,
      ],
    }
    const opts = interestQuestions[id] || [
      `I see you're into ${label} — tell me more!`,
      `How'd you get into ${label}?`,
      `${label} is cool! What do you like about it?`,
    ]
    questions.push(pick(opts))
  })

  // Based on languages
  const languages = Array.isArray(profile.languages) ? profile.languages : []
  if (languages.length > 0) {
    const langLabels = languages.map(getLanguageLabel).filter(Boolean)
    if (langLabels.length > 1) {
      questions.push(pick([
        `You speak ${langLabels.join(' and ')} — that's impressive!`,
        `Wow, ${langLabels.length} languages! Which one do you use most?`,
        `Multilingual! Do you switch between languages often?`,
      ]))
    } else if (langLabels.length === 1 && langLabels[0] !== 'English') {
      questions.push(pick([
        `Do you speak ${langLabels[0]} at home or with family?`,
        `How'd you learn ${langLabels[0]}?`,
        `${langLabels[0]}! That's cool. Are you fluent?`,
      ]))
    }
  }

  // Generic openers
  const genericOpeners = [
    `Hey ${firstName}! What's the best thing that happened to you this week?`,
    `Nice to connect! What brings you to Glimmer?`,
    `Hi ${firstName}! What do you usually do on weekends?`,
    `Hey! What's something you're excited about lately?`,
    `So ${firstName}, what's your favorite way to spend free time?`,
  ]
  questions.push(pick(genericOpeners))
  questions.push(pick(genericOpeners.filter((q) => !questions.includes(q))))

  // Deduplicate and shuffle, return max 8
  const seen = new Set()
  const unique = questions.filter((q) => {
    const key = q.slice(0, 50)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  
  // Shuffle using seed
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(random(i + 1))
    ;[unique[i], unique[j]] = [unique[j], unique[i]]
  }
  
  return unique.slice(0, 8)
}
