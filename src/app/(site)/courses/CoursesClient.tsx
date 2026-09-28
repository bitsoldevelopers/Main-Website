"use client";

import { motion } from "framer-motion";
import { BookOpen, Users, Star, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

const courses = [
  {
    title: "Digital Marketing Mastery",
    desc: "A comprehensive guide to modern marketing, from SEO and PPC to AI-driven social media strategies.",
    price: "$299",
    duration: "12 Weeks",
    students: "1.2k+",
    rating: "4.9",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80",
    tags: ["Marketing", "AI", "SEO"],
  },
  {
    title: "Complete AI Mastery",
    desc: "Learn to build and deploy AI agents, automate business workflows, and master LLM prompt engineering.",
    price: "$499",
    duration: "16 Weeks",
    students: "850+",
    rating: "5.0",
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80",
    tags: ["Artificial Intelligence", "Python", "Automation"],
  },
  {
    title: "PSX Trading Course",
    desc: "Master the Pakistan Stock Exchange with our professional-grade technical analysis and algorithm course.",
    price: "$349",
    duration: "10 Weeks",
    students: "2.1k+",
    rating: "4.8",
    image: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80",
    tags: ["Trading", "Finance", "PSX"],
  },
];

export default function CoursesClient() {
  return (
    <div className="pt-32 pb-24 bg-white dark:bg-brand-dark">
      <div className="container mx-auto px-6 text-center mb-20">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-7xl font-bold mb-6 text-slate-900 dark:text-white"
        >
          BITSOL <span className="text-gradient">Academy</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xl text-slate-600 dark:text-brand-muted max-w-2xl mx-auto"
        >
          Master the skills of the future. Our courses are designed by industry experts to give you a competitive edge in the AI-driven world.
        </motion.p>
      </div>

      <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {courses.map((course, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="flex flex-col overflow-hidden group rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl hover:border-brand-purple/50 transition-all shadow-lg dark:shadow-none"
          >
            <div className="h-60 relative overflow-hidden">
              <Image
                src={course.image}
                alt={course.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute top-4 left-4 flex gap-2">
                {course.tags.map((tag, j) => (
                  <Badge key={j} className="bg-white/80 dark:bg-brand-dark/80 backdrop-blur-md border-slate-200 dark:border-white/10 text-brand-purple dark:text-brand-cyan">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="p-8 flex flex-col flex-grow">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-1 text-yellow-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="text-sm font-bold">{course.rating}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500 dark:text-brand-muted text-sm">
                  <Users className="w-4 h-4" />
                  <span>{course.students} Students</span>
                </div>
              </div>

              <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white group-hover:text-brand-cyan transition-colors">
                {course.title}
              </h3>
              <p className="text-slate-500 dark:text-brand-muted text-sm leading-relaxed mb-8">
                {course.desc}
              </p>

              <div className="mt-auto">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-brand-muted text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{course.duration}</span>
                  </div>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{course.price}</span>
                </div>
                <Button className="w-full bg-brand-purple hover:bg-brand-purple/90 text-white rounded-xl py-6 font-bold text-lg">
                  Enroll Now
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="container mx-auto px-6 mt-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
          <div>
            <h2 className="text-4xl font-bold mb-8 text-slate-900 dark:text-white">Why Learn With BITSOL?</h2>
            <div className="space-y-6">
              {[
                "Live Interactive Classes",
                "Industry Expert Mentors",
                "Verified Certificates",
                "Lifetime Access to Resources",
                "Job Placement Assistance",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-6 h-6 rounded-full bg-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-lg text-slate-800 dark:text-brand-white">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-brand-cyan/20 blur-3xl rounded-full" />
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl p-10 relative z-10 text-center shadow-lg dark:shadow-none">
              <BookOpen className="w-20 h-20 text-brand-cyan mx-auto mb-6" />
              <h3 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">Student Community</h3>
              <p className="text-slate-500 dark:text-brand-muted mb-8">
                Join 5,000+ students already mastering the digital skills that matter.
              </p>
              <Button variant="outline" className="border-brand-cyan text-brand-cyan rounded-full px-10">
                Join Discord Community
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
