import artist1 from "@/assets/artist-1.jpg";
import artist2 from "@/assets/artist-2.jpg";

export interface Track {
  title: string;
  duration: string;
  audioUrl?: string;
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
    id: "pitch-black-afro",
    name: "Pitch Black Afro",
    tagline: "The Godfather of SA Hip-Hop",
    genre: "Hip-Hop / Kwaito",
    image: artist1,
    bio: "Pitch Black Afro, born Thulani Ngcobo, is one of South Africa's most iconic and pioneering hip-hop artists. Emerging from the early 2000s Johannesburg scene, he helped define the sound and culture of South African hip-hop at a time when the genre was still finding its footing on the continent. With a distinctive style that fuses hip-hop lyricism with kwaito rhythms and street-level storytelling, Pitch Black Afro became a household name and a cultural force. His influence extends beyond music — he is a mentor, a cultural pillar, and a living legend whose impact on the next generation of South African artists is immeasurable.",
    discography: [
      { title: "Styling Gel", year: "2004" },
      { title: "Zonke Bonke", year: "2006" },
      { title: "African Taboo", year: "2010" },
    ],
    pressQuotes: [
      { quote: "One of the true architects of South African hip-hop culture.", source: "Channel O" },
      { quote: "Pitch Black Afro paved the way for an entire generation of SA rappers.", source: "OkayAfrica" },
    ],
    socials: [
      { platform: "Instagram", url: "#" },
      { platform: "Spotify", url: "#" },
      { platform: "YouTube", url: "#" },
    ],
    tracks: [
      { title: "Styling Gel", duration: "4:12" },
      { title: "Zonke Bonke", duration: "3:58" },
      { title: "African Taboo", duration: "4:35" },
    ],
    streaming: {
      spotify: "#",
      appleMusic: "#",
      youtubeMusic: "#",
    },
  },
  {
    id: "wijo-da-weekend",
    name: "WIJO da WEEKEND",
    tagline: "The Sound of Survival",
    genre: "Afrobeat / Hip-Hop",
    image: artist2,
    bio: "Born Vusi William Moya on 27 February 1987, in the heart of Alexandra Township, north of Johannesburg, Wijo da Weekend's story is one of transformation, resilience, and purpose forged in fire. Raised by his aunt and step-grandmother after the loss of his father, Wijo grew up in an environment where survival was not guaranteed — but identity was waiting to be discovered. From an early age, he found refuge in music and dance, performing alongside respected names such as Vukani Khoza (Skomplas), DJ Funtron, and Biblos. In 2014, his life reached a turning point — he was sentenced to 25 years in prison. Inside those walls, he discovered rap, writing his first verses and beginning a powerful personal transformation. Mentored by hip-hop legend Pitch Black Afro, Wijo developed his signature style — combining raw storytelling, township influence, and global musical elements into what he calls 'Lyrical Kung-Fu'. Released in 2023, he emerged not just free — but focused, refined, and ready. Now stepping into the music industry with intention, Wijo da Weekend represents a new wave of artists whose music is rooted in truth, survival, and inspiration.",
    discography: [
      { title: "Shooting Star (Single)", year: "2025" },
    ],
    pressQuotes: [
      { quote: "Music chose me and saved me… now I choose to inspire.", source: "WIJO da WEEKEND" },
      { quote: "Wijo da Weekend is the sound of survival — refined into a global movement.", source: "Sonic Legacy Studios" },
    ],
    socials: [
      { platform: "Instagram", url: "#" },
      { platform: "TikTok", url: "#" },
      { platform: "YouTube", url: "#" },
    ],
    tracks: [
      { title: "Shooting Star", duration: "3:45" },
    ],
    streaming: {
      spotify: "#",
      appleMusic: "#",
      youtubeMusic: "#",
      soundcloud: "#",
    },
  },
];
