import type { Metadata } from 'next'
import { Demo } from '@/components/demo/demo'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'

export const metadata: Metadata = {
  title: 'Demo',
  description: 'Step through a replay of a real ResolvePR scan: the diff, the AST chunks tree-sitter extracted, the Claude review, and what the pull request author sees.',
}

export default function DemoPage() {
  return (
    <>
      <SiteHeader current="demo" />
      <Demo />
      <SiteFooter />
    </>
  )
}
