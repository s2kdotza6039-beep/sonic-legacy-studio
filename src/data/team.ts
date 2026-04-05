import exec1 from "@/assets/exec-1.jpg";
import exec2 from "@/assets/exec-2.jpg";
import exec3 from "@/assets/exec-3.jpg";
import exec4 from "@/assets/exec-4.jpg";

export interface Executive {
  name: string;
  title: string;
  bio: string;
  expertise: string;
  image: string;
}

export const executives: Executive[] = [
  {
    name: "Thulani 'Pitch Black Afro' Ngcobo",
    title: "Founder • Creative Director • Lead Performer",
    bio: "A pioneering figure in South African hip-hop, Pitch Black Afro leads s2kDOTza's strategic vision at the intersection of music, culture, and business. With a career spanning decades, his journey reflects resilience, reinvention, and deep cultural influence. He oversees artist development, creative direction, and cultural positioning — ensuring every project aligns with artistic integrity and global market relevance. His approach combines street-level authenticity with executive-level strategy, building sustainable opportunities for emerging talent while keeping s2kDOTza culturally grounded and internationally competitive.",
    expertise: "Music Business Growth Strategy & Music Production",
    image: exec1,
  },
  {
    name: "Lerato 'Lava' Mafisa",
    title: "Social Media Strategist",
    bio: "Lerato is the digital voice behind S2KDOTZA's online presence. With a sharp eye for trends and a deep understanding of audience engagement, she crafts compelling social media strategies that amplify the brand and its artists across platforms. Her work bridges culture and content, turning followers into communities.",
    expertise: "Social Media Strategy & Digital Marketing",
    image: exec2,
  },
];
