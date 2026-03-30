import artist1 from "@/assets/artist-1.jpg";
import artist2 from "@/assets/artist-2.jpg";
import artist3 from "@/assets/artist-3.jpg";
import artist4 from "@/assets/artist-4.jpg";

export interface Track {
  title: string;
  duration: string;
  audioUrl?: string; // MP3 URL for embedded playback
}

export interface StreamingLinks {
  spotify?: string;
  appleMusic?: string;
  soundcloud?: string;
  youtubeMusic?: string;
}

export interface Artist {
  id: string;
  name: string;
  tagline: string;
  genre: string;
  image: string;
  bio: string;
  discography: { title: string; year: string }[];
  pressQuotes: { quote: string; source: string }[];
  socials: { platform: string; url: string }[];
  tracks: Track[];
  streaming: StreamingLinks;
}

export const artists: Artist[] = [
  {
    id: "kxng-velo",
    name: "KXNG Velo",
    tagline: "The Future of South African Hip-Hop",
    genre: "Hip-Hop / Trap",
    image: artist1,
    bio: "Rising from the streets of Johannesburg, KXNG Velo has rapidly become one of the most electrifying voices in South African hip-hop. With a distinctive flow that bridges street narratives and global appeal, his debut project garnered over 5 million streams within its first month. His raw authenticity and relentless work ethic have positioned him as the next breakout star on the continent.",
    discography: [
      { title: "Crown Theory", year: "2025" },
      { title: "Velo City (EP)", year: "2024" },
      { title: "No Shortcuts", year: "2023" },
    ],
    pressQuotes: [
      { quote: "A generational talent redefining the sound of SA hip-hop.", source: "Rolling Stone Africa" },
      { quote: "KXNG Velo doesn't just rap — he commands.", source: "Complex" },
    ],
    socials: [
      { platform: "Instagram", url: "#" },
      { platform: "Spotify", url: "#" },
      { platform: "Apple Music", url: "#" },
    ],
    tracks: [
      { title: "Crown Theory", duration: "3:42" },
      { title: "No Shortcuts", duration: "4:15" },
      { title: "Velo City", duration: "3:28" },
    ],
    streaming: {
      spotify: "#",
      appleMusic: "#",
      youtubeMusic: "#",
    },
  },
  {
    id: "aura-cole",
    name: "Aura Cole",
    tagline: "Soul That Moves the World",
    genre: "R&B / Neo-Soul",
    image: artist2,
    bio: "Aura Cole's voice is a force of nature. Blending neo-soul with contemporary R&B, she crafts music that is both deeply personal and universally resonant. Her sophomore album 'Golden Hour' debuted at #3 on the South African charts and earned critical acclaim from international publications. Aura's live performances are legendary — intimate, powerful, and unforgettable.",
    discography: [
      { title: "Golden Hour", year: "2025" },
      { title: "Midnight Letters", year: "2024" },
      { title: "Echoes (EP)", year: "2023" },
    ],
    pressQuotes: [
      { quote: "The voice of a generation, draped in gold.", source: "The FADER" },
      { quote: "Aura Cole is the future of African R&B.", source: "OkayAfrica" },
    ],
    socials: [
      { platform: "Instagram", url: "#" },
      { platform: "Spotify", url: "#" },
      { platform: "YouTube", url: "#" },
    ],
    tracks: [
      { title: "Golden Hour", duration: "4:05" },
      { title: "Midnight Letters", duration: "3:50" },
      { title: "Echoes", duration: "3:33" },
    ],
    streaming: {
      spotify: "#",
      appleMusic: "#",
      soundcloud: "#",
    },
  },
  {
    id: "dj-phantom",
    name: "DJ Phantom",
    tagline: "Afrobeats Without Borders",
    genre: "Afrobeats / Amapiano",
    image: artist3,
    bio: "DJ Phantom has been at the forefront of the Amapiano and Afrobeats crossover, producing chart-topping hits that have dominated dance floors from Lagos to London. His production style fuses deep African rhythms with global electronic elements, creating a sound that transcends geography. With multiple platinum records and international tours under his belt, Phantom is building an empire.",
    discography: [
      { title: "Continental Shift", year: "2025" },
      { title: "Frequencies", year: "2024" },
      { title: "The Log Drum Sessions", year: "2023" },
    ],
    pressQuotes: [
      { quote: "The architect of Africa's new sonic identity.", source: "Billboard" },
      { quote: "Every track is a passport to the dancefloor.", source: "Mixmag" },
    ],
    socials: [
      { platform: "Instagram", url: "#" },
      { platform: "SoundCloud", url: "#" },
      { platform: "Spotify", url: "#" },
    ],
    tracks: [
      { title: "Continental Shift", duration: "5:12" },
      { title: "Frequencies", duration: "4:30" },
      { title: "Log Drum Sessions", duration: "6:01" },
    ],
    streaming: {
      spotify: "#",
      soundcloud: "#",
      youtubeMusic: "#",
    },
  },
  {
    id: "nova-kim",
    name: "Nova Kim",
    tagline: "Pop Redefined",
    genre: "Pop / Alternative",
    image: artist4,
    bio: "Nova Kim is rewriting the rules of pop music. With a genre-defying sound that pulls from alternative rock, electronic, and African pop traditions, she has built a devoted global fanbase. Her visual artistry is as compelling as her music — every release is a cinematic experience. Nova's debut album was named one of the top 10 albums of the year by multiple international outlets.",
    discography: [
      { title: "Supernova", year: "2025" },
      { title: "Electric Bloom (EP)", year: "2024" },
      { title: "First Light", year: "2023" },
    ],
    pressQuotes: [
      { quote: "Nova Kim isn't just making music — she's building a universe.", source: "Pitchfork" },
      { quote: "The most exciting new voice in global pop.", source: "NME" },
    ],
    socials: [
      { platform: "Instagram", url: "#" },
      { platform: "TikTok", url: "#" },
      { platform: "Spotify", url: "#" },
    ],
  },
];
