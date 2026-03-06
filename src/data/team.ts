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
    name: "Marcus Van Der Berg",
    title: "Chief Executive Officer",
    bio: "With over 18 years in the music and entertainment industry, Marcus has led s2kDOTza from a boutique management firm to a full-service entertainment company with international reach. His strategic vision has guided partnerships with major labels and global brands.",
    expertise: "Corporate Strategy & Business Development",
    image: exec1,
  },
  {
    name: "Thandi Mokoena",
    title: "Chief Operating Officer",
    bio: "Thandi brings a decade of operational excellence from the worlds of media and entertainment. She oversees the company's day-to-day operations, ensuring that every division runs with precision and purpose. Her leadership has been instrumental in scaling the company's infrastructure.",
    expertise: "Operations & Talent Management",
    image: exec2,
  },
  {
    name: "David Chen",
    title: "VP of Creative & A&R",
    bio: "David is the creative engine of s2kDOTza. With a background in music production and A&R at two major labels, he identifies and develops talent with an ear for what's next. His curatorial instinct has shaped the company's acclaimed roster.",
    expertise: "A&R, Music Production & Creative Direction",
    image: exec3,
  },
  {
    name: "Natasha Olivier",
    title: "General Counsel & Head of Business Affairs",
    bio: "Natasha's legal expertise spans entertainment law, publishing, and international licensing. She protects the company's interests and those of its artists, ensuring that every deal is structured for long-term success and growth.",
    expertise: "Entertainment Law & Publishing",
    image: exec4,
  },
];
