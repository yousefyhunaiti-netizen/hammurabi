'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase'
import Footer from '../components/Footer'

type Post = {
  postSource: string
  id: number
  lawyer_id: number | null
  firm_id: number | null
  title: string
  body: string
  image_url?: string | null
  created_at: string
}

type LawyerInfo = {
  id: number
  full_name: string
  firm_id: number | null
}

type Firm = {
  id: number
  firm_name: string
  show_lawyer_names: boolean | null
}

type Like = {
  post_type: string
  post_id: number
  lawyer_id: number | null
  firm_id: number | null
}

type Repost = {
  post_type: string
  post_id: number
  lawyer_id: number | null
  firm_id: number | null
}

type Comment = {
  id: number
  story_id: number
  lawyer_id: number | null
  firm_id: number | null
  body: string
  created_at: string
  parent_comment_id: number | null
}

type Identity = {
  type: 'lawyer' | 'firm'
  id: number
  name: string
}

export default function CommunityPage() {
  const [loading, setLoading] = useState(true)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [myIdentity, setMyIdentity] = useState<Identity | null>(null)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)
  const [posts, setPosts] = useState<Post[]>([])
  const [lawyerInfos, setLawyerInfos] = useState<LawyerInfo[]>([])
  const [firms, setFirms] = useState<Firm[]>([])
  const [likes, setLikes] = useState<Like[]>([])
  const [reposts, setReposts] = useState<Repost[]>([])
  const [comments, setComments] = useState<Comment[]>([])

  const [searchTerm, setSearchTerm] = useState('')
  const [commentInput, setCommentInput] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [replyingToId, setReplyingToId] = useState<number | null>(null)
  const [replyInput, setReplyInput] = useState('')

  const [composeOpen, setComposeOpen] = useState(false)
  const [composeText, setComposeText] = useState('')
  const [composeImageFile, setComposeImageFile] = useState<File | null>(null)
  const [composeImagePreview, setComposeImagePreview] = useState('')
  const [posting, setPosting] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  const [openPost, setOpenPost] = useState<Post | null>(null)
  const [menuOpenPostKey, setMenuOpenPostKey] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  async function loadFeed() {
    const questionsResult = await supabase.from('community_questions').select('id, lawyer_id, title, body, created_at').order('created_at', { ascending: false })
    const storiesResult = await supabase.from('success_stories').select('id, lawyer_id, firm_id, title, body, image_url, created_at').order('created_at', { ascending: false })

    const qData = (questionsResult.data || []).map(function (q: any) {
      return { postSource: 'question', id: q.id, lawyer_id: q.lawyer_id, firm_id: null, title: q.title, body: q.body, created_at: q.created_at }
    })
    const sData = (storiesResult.data || []).map(function (s: any) {
      return { postSource: 'story', id: s.id, lawyer_id: s.lawyer_id, firm_id: s.firm_id, title: s.title, body: s.body, image_url: s.image_url, created_at: s.created_at }
    })

    const allPosts = qData.concat(sData).sort(function (a: Post, b: Post) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    setPosts(allPosts)

    const lawyerIds = Array.from(new Set(allPosts.map(function (p: Post) { return p.lawyer_id }).filter(function (id) { return id !== null })))
    let lawyersData: LawyerInfo[] = []
    if (lawyerIds.length > 0) {
      const namesResult = await supabase.from('lawyers').select('id, full_name, firm_id').in('id', lawyerIds)
      lawyersData = namesResult.data || []
      setLawyerInfos(lawyersData)
    }

    const postFirmIds = allPosts.map(function (p: Post) { return p.firm_id }).filter(function (id) { return id !== null })
    const lawyerFirmIds = lawyersData.map(function (l) { return l.firm_id }).filter(function (id) { return id !== null })
    const allFirmIds = Array.from(new Set(postFirmIds.concat(lawyerFirmIds)))

    if (allFirmIds.length > 0) {
      const firmsResult = await supabase.from('firms').select('id, firm_name, show_lawyer_names').in('id', allFirmIds)
      setFirms(firmsResult.data || [])
    }

    const likesResult = await supabase.from('post_likes').select('post_type, post_id, lawyer_id, firm_id')
    setLikes(likesResult.data || [])

    const repostsResult = await supabase.from('reposts').select('post_type, post_id, lawyer_id, firm_id')
    setReposts(repostsResult.data || [])

    const commentsResult = await supabase.from('story_comments').select('*').order('created_at', { ascending: true })
    setComments(commentsResult.data || [])
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const lawyerResult = await supabase
        .from('lawyers')
        .select('id, full_name, is_active, is_comped')
        .eq('user_id', userResult.data.user.id)
        .maybeSingle()

      if (lawyerResult.data) {
        if (!lawyerResult.data.is_active && !lawyerResult.data.is_comped) {
          setNotSubscribed(true)
          setLoading(false)
          return
        }

        setMyIdentity({ type: 'lawyer', id: lawyerResult.data.id, name: lawyerResult.data.full_name })

        const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
        const uniqueSenders = new Set((unreadResult.data || []).map(function (m) {
          return m.sender_lawyer_id ? 'lawyer-' + m.sender_lawyer_id : 'firm-' + m.sender_firm_id
        }))
        setTotalUnread(uniqueSenders.size)

        const pendingResult = await supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('lawyer_id', lawyerResult.data.id).eq('status', 'pending')
        setPendingConsultations(pendingResult.count || 0)

        await loadFeed()
        setLoading(false)
        return
      }

      const firmResult = await supabase
        .from('firms')
        .select('id, firm_name, is_active, is_comped')
        .eq('user_id', userResult.data.user.id)
        .maybeSingle()

      if (firmResult.data) {
        if (!firmResult.data.is_active && !firmResult.data.is_comped) {
          setNotSubscribed(true)
          setLoading(false)
          return
        }

        setMyIdentity({ type: 'firm', id: firmResult.data.id, name: firmResult.data.firm_name })

        const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmResult.data.id).eq('is_read', false)
        const uniqueSenders = new Set((unreadResult.data || []).map(function (m) {
          return m.sender_lawyer_id ? 'lawyer-' + m.sender_lawyer_id : 'firm-' + m.sender_firm_id
        }))
        setTotalUnread(uniqueSenders.size)

        const rosterResult = await supabase.from('lawyers').select('id').eq('firm_id', firmResult.data.id)
        const rosterIds = (rosterResult.data || []).map(function (l) { return l.id })
        let firmPendingResult
        if (rosterIds.length > 0) {
          firmPendingResult = await supabase.from('consultations').select('id', { count: 'exact', head: true }).or('firm_id.eq.' + firmResult.data.id + ',lawyer_id.in.(' + rosterIds.join(',') + ')').eq('status', 'pending')
        } else {
          firmPendingResult = await supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('firm_id', firmResult.data.id).eq('status', 'pending')
        }
        setPendingConsultations(firmPendingResult.count || 0)

        await loadFeed()
        setLoading(false)
        return
      }

      setNotAllowed(true)
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  useEffect(function () {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return function () {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files ? e.target.files[0] : null
    setComposeImageFile(file)

    if (file) {
      const reader = new FileReader()
      reader.onload = function () {
        setComposeImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setComposeImagePreview('')
    }
  }

  function triggerFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  function removeSelectedImage() {
    setComposeImageFile(null)
    setComposeImagePreview('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handlePost() {
    if (!composeText.trim() || !myIdentity) return
    setPosting(true)
    setActionMessage('')

    let imageUrl = ''
    if (composeImageFile) {
      const filePath = 'post-' + myIdentity.type + '-' + myIdentity.id + '-' + Date.now() + '-' + composeImageFile.name
      const uploadResult = await supabase.storage.from('post-images').upload(filePath, composeImageFile)

      if (uploadResult.error) {
        setPosting(false)
        setActionMessage('حدث خطأ أثناء رفع الصورة: ' + uploadResult.error.message)
        return
      }

      const urlResult = supabase.storage.from('post-images').getPublicUrl(filePath)
      imageUrl = urlResult.data.publicUrl
    }

    const insertData: any = {
      title: '',
      body: composeText,
      image_url: imageUrl || null,
      lawyer_id: myIdentity.type === 'lawyer' ? myIdentity.id : null,
      firm_id: myIdentity.type === 'firm' ? myIdentity.id : null,
    }

    const insertResult = await supabase.from('success_stories').insert(insertData)

    setPosting(false)

    if (insertResult.error) {
      setActionMessage('حدث خطأ أثناء النشر: ' + insertResult.error.message)
      return
    }

    setComposeText('')
    removeSelectedImage()
    setComposeOpen(false)
    await loadFeed()
  }

  async function handleDeletePost(post: Post) {
    const tableName = post.postSource === 'question' ? 'community_questions' : 'success_stories'
    await supabase.from(tableName).delete().eq('id', post.id)
    setOpenPost(null)
    setMenuOpenPostKey(null)
    await loadFeed()
  }

  async function handleToggleLike(pType: string, postId: number) {
    if (!myIdentity) return
    setActionMessage('')

    const idField = myIdentity.type === 'lawyer' ? 'lawyer_id' : 'firm_id'
    const existing = likes.find(function (l) {
      return l.post_type === pType && l.post_id === postId &&
        (myIdentity.type === 'lawyer' ? l.lawyer_id === myIdentity.id : l.firm_id === myIdentity.id)
    })

    if (existing) {
      await supabase.from('post_likes').delete().eq('post_type', pType).eq('post_id', postId).eq(idField, myIdentity.id)
    } else {
      const insertData: any = { post_type: pType, post_id: postId, lawyer_id: null, firm_id: null }
      insertData[idField] = myIdentity.id
      await supabase.from('post_likes').insert(insertData)
    }

    await loadFeed()
  }

  async function handleRepost(pType: string, postId: number) {
    if (!myIdentity) return
    setActionMessage('')

    const idField = myIdentity.type === 'lawyer' ? 'lawyer_id' : 'firm_id'
    const existing = reposts.find(function (r) {
      return r.post_type === pType && r.post_id === postId &&
        (myIdentity.type === 'lawyer' ? r.lawyer_id === myIdentity.id : r.firm_id === myIdentity.id)
    })

    if (existing) {
      await supabase.from('reposts').delete().eq('post_type', pType).eq('post_id', postId).eq(idField, myIdentity.id)
    } else {
      const insertData: any = { post_type: pType, post_id: postId, lawyer_id: null, firm_id: null }
      insertData[idField] = myIdentity.id
      await supabase.from('reposts').insert(insertData)
    }

    await loadFeed()
  }

  async function handleAddComment(postId: number) {
    if (!commentInput.trim() || !myIdentity) return
    setCommentSubmitting(true)

    await supabase.from('story_comments').insert({
      story_id: postId,
      lawyer_id: myIdentity.type === 'lawyer' ? myIdentity.id : null,
      firm_id: myIdentity.type === 'firm' ? myIdentity.id : null,
      body: commentInput,
      parent_comment_id: null,
    })

    setCommentInput('')
    setCommentSubmitting(false)
    await loadFeed()
  }

  async function handleAddReply(postId: number, parentId: number) {
    if (!replyInput.trim() || !myIdentity) return

    await supabase.from('story_comments').insert({
      story_id: postId,
      lawyer_id: myIdentity.type === 'lawyer' ? myIdentity.id : null,
      firm_id: myIdentity.type === 'firm' ? myIdentity.id : null,
      body: replyInput,
      parent_comment_id: parentId,
    })

    setReplyInput('')
    setReplyingToId(null)
    await loadFeed()
  }

  async function handleDeleteComment(commentId: number) {
    await supabase.from('story_comments').delete().eq('id', commentId)
    await loadFeed()
  }

  function getAttributionLabel(post: { lawyer_id: number | null; firm_id: number | null }) {
    if (post.firm_id) {
      const firm = firms.find(function (f) { return f.id === post.firm_id })
      return firm ? firm.firm_name : ''
    }

    if (post.lawyer_id) {
      const lawyer = lawyerInfos.find(function (l) { return l.id === post.lawyer_id })
      if (!lawyer) return ''

      if (lawyer.firm_id) {
        const firm = firms.find(function (f) { return f.id === lawyer.firm_id })
        if (firm) {
          return firm.show_lawyer_names ? firm.firm_name + ' — ' + lawyer.full_name : firm.firm_name
        }
      }

      return lawyer.full_name
    }

    return ''
  }

  function getCommentAuthorLabel(c: Comment) {
    return getAttributionLabel({ lawyer_id: c.lawyer_id, firm_id: c.firm_id })
  }

  function isMinePost(post: Post) {
    if (!myIdentity) return false
    if (myIdentity.type === 'lawyer') return post.lawyer_id === myIdentity.id
    return post.firm_id === myIdentity.id
  }

  function isMineComment(c: Comment) {
    if (!myIdentity) return false
    if (myIdentity.type === 'lawyer') return c.lawyer_id === myIdentity.id
    return c.firm_id === myIdentity.id
  }

  function getLikeCount(pType: string, postId: number) {
    return likes.filter(function (l) { return l.post_type === pType && l.post_id === postId }).length
  }

  function isLikedByMe(pType: string, postId: number) {
    if (!myIdentity) return false
    return likes.some(function (l) {
      return l.post_type === pType && l.post_id === postId &&
        (myIdentity.type === 'lawyer' ? l.lawyer_id === myIdentity.id : l.firm_id === myIdentity.id)
    })
  }

  function getRepostCount(pType: string, postId: number) {
    return reposts.filter(function (r) { return r.post_type === pType && r.post_id === postId }).length
  }

  function isRepostedByMe(pType: string, postId: number) {
    if (!myIdentity) return false
    return reposts.some(function (r) {
      return r.post_type === pType && r.post_id === postId &&
        (myIdentity.type === 'lawyer' ? r.lawyer_id === myIdentity.id : r.firm_id === myIdentity.id)
    })
  }

  function getTopLevelComments(postId: number) {
    return comments.filter(function (c) { return c.story_id === postId && !c.parent_comment_id })
  }

  function getReplies(commentId: number) {
    return comments.filter(function (c) { return c.parent_comment_id === commentId })
  }

  function getTotalCommentCount(postId: number) {
    return comments.filter(function (c) { return c.story_id === postId }).length
  }

  function getTopContributorIds() {
    const scoreMap: { [key: string]: number } = {}
    posts.forEach(function (p) {
      const key = p.firm_id ? 'firm-' + p.firm_id : 'lawyer-' + p.lawyer_id
      scoreMap[key] = (scoreMap[key] || 0) + 1
    })
    const entries = Object.entries(scoreMap).sort(function (a, b) { return b[1] - a[1] })
    return entries.slice(0, 3).map(function (e) { return e[0] })
  }

  const topContributorKeys = getTopContributorIds()

  function isTopContributor(post: { lawyer_id: number | null; firm_id: number | null }) {
    const key = post.firm_id ? 'firm-' + post.firm_id : 'lawyer-' + post.lawyer_id
    return topContributorKeys.indexOf(key) !== -1
  }

  function renderTextWithHashtags(text: string) {
    const parts = text.split(/(#[\u0600-\u06FFa-zA-Z0-9_]+)/g)
    return parts.map(function (part, i) {
      if (part.indexOf('#') === 0) {
        return <span key={i} className="text-[#AD8A4E] font-bold">{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  const filteredPosts = posts.filter(function (p) {
    if (!searchTerm.trim()) return true
    const lower = searchTerm.toLowerCase()
    const authorName = getAttributionLabel(p).toLowerCase()
    const textContent = (p.title + ' ' + p.body).toLowerCase()
    return authorName.indexOf(lower) !== -1 || textContent.indexOf(lower) !== -1
  })

  function renderActionsBar(p: Post, pType: string) {
    const likeCount = getLikeCount(pType, p.id)
    const liked = isLikedByMe(pType, p.id)
    const repostCount = getRepostCount(pType, p.id)
    const reposted = isRepostedByMe(pType, p.id)
    const totalComments = getTotalCommentCount(p.id)

    function likeClick(e: React.MouseEvent) {
      e.stopPropagation()
      handleToggleLike(pType, p.id)
    }

    function repostClick(e: React.MouseEvent) {
      e.stopPropagation()
      handleRepost(pType, p.id)
    }

    function openClick(e: React.MouseEvent) {
      e.stopPropagation()
      setOpenPost(p)
    }

    return (
      <div className="flex items-center justify-between px-5 py-3 border-t border-[#D8D2C4] bg-[#F3EEE4]">
        <div className="flex items-center gap-4">
          <button type="button" onClick={likeClick} className={"cursor-pointer flex items-center gap-1 font-['Tajawal'] text-xs " + (liked ? 'text-[#AD8A4E] font-bold' : 'text-[#4A473F]')}>
            👍 {likeCount > 0 ? likeCount : ''} {liked ? 'إلغاء الإعجاب' : 'إعجاب'}
          </button>

          <button type="button" onClick={openClick} className="cursor-pointer font-['Tajawal'] text-xs text-[#4A473F]">
            {totalComments} تعليق
          </button>
        </div>

        <button
          type="button"
          onClick={repostClick}
          className={"cursor-pointer flex items-center gap-1 font-['Tajawal'] text-xs px-3 py-1.5 rounded-md transition " + (reposted ? 'bg-[#AD8A4E] text-white' : 'bg-white text-[#4A473F] border border-[#D8D2C4]')}
        >
          🔁 {reposted ? 'تمت إعادة النشر' : 'إعادة نشر'} {repostCount > 0 ? '(' + repostCount + ')' : ''}
        </button>
      </div>
    )
  }

  function renderPost(p: Post) {
    const pType = p.postSource === 'question' ? 'question' : 'story'
    const attributionLabel = getAttributionLabel(p)
    const isMine = isMinePost(p)
    const postKey = pType + '-' + p.id
    const menuOpenHere = menuOpenPostKey === postKey

    function cardClick() {
      setOpenPost(p)
    }

    function menuButtonClick(e: React.MouseEvent) {
      e.stopPropagation()
      setMenuOpenPostKey(menuOpenHere ? null : postKey)
    }

    function deleteClick(e: React.MouseEvent) {
      e.stopPropagation()
      handleDeletePost(p)
    }

    return (
      <div key={postKey} className="bg-white border border-[#D8D2C4] rounded-lg mb-4 overflow-hidden cursor-pointer relative" onClick={cardClick}>
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#1B1A17] flex items-center justify-center text-[#AD8A4E] font-['Amiri'] text-lg flex-shrink-0">
                {attributionLabel.charAt(0)}
              </div>
              <div className="flex items-center gap-2">
                <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">{attributionLabel}</p>
                {isTopContributor(p) && (
                  <span className="text-xs" title="أحد أكثر المساهمين نشاطاً">🏆</span>
                )}
              </div>
            </div>

            {isMine && (
              <div className="relative">
                <button type="button" onClick={menuButtonClick} className="cursor-pointer text-[#4A473F] px-2">⋮</button>
                {menuOpenHere && (
                  <div className="absolute left-0 top-full mt-1 bg-white border border-[#D8D2C4] rounded-md shadow-lg z-10 w-32">
                    <button type="button" onClick={deleteClick} className="cursor-pointer w-full text-right px-4 py-2 font-['Tajawal'] text-xs text-[#7A2E2E] hover:bg-[#F3EEE4]">
                      حذف المنشور
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {p.title && <h3 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-2">{p.title}</h3>}
          <p className="font-['Tajawal'] text-sm text-[#4A473F] whitespace-pre-wrap line-clamp-4">{renderTextWithHashtags(p.body)}</p>

          {p.image_url && (
            <img src={p.image_url} alt="" className="w-full rounded-md mt-3 object-cover max-h-72" />
          )}
        </div>

        {renderActionsBar(p, pType)}
      </div>
    )
  }

  function renderComment(c: Comment, postId: number, isReply: boolean) {
    const isMyComment = isMineComment(c)
    const commentLiked = isLikedByMe('comment', c.id)
    const commentLikeCount = getLikeCount('comment', c.id)
    const replies = isReply ? [] : getReplies(c.id)
    const isReplyingHere = replyingToId === c.id

    function deleteClick() {
      handleDeleteComment(c.id)
    }

    function likeClick() {
      handleToggleLike('comment', c.id)
    }

    function replyToggle() {
      setReplyingToId(isReplyingHere ? null : c.id)
      setReplyInput('')
    }

    function replyInputChange(e: React.ChangeEvent<HTMLInputElement>) {
      setReplyInput(e.target.value)
    }

    function submitReply() {
      handleAddReply(postId, c.id)
    }

    return (
      <div key={c.id} className={isReply ? 'mr-6 mt-2' : 'mb-3'}>
        <div className="flex justify-between items-start">
          <div>
            <p className="font-['Tajawal'] text-xs font-bold text-[#1B1A17]">{getCommentAuthorLabel(c)}</p>
            <p className="font-['Tajawal'] text-sm text-[#4A473F]">{c.body}</p>
            <div className="flex items-center gap-3 mt-1">
              <button type="button" onClick={likeClick} className={"cursor-pointer font-['Tajawal'] text-xs " + (commentLiked ? 'text-[#AD8A4E] font-bold' : 'text-[#4A473F]')}>
                👍 {commentLikeCount > 0 ? commentLikeCount : ''} {commentLiked ? 'إلغاء الإعجاب' : 'إعجاب'}
              </button>
              {!isReply && (
                <button type="button" onClick={replyToggle} className="cursor-pointer font-['Tajawal'] text-xs text-[#4A473F]">
                  رد
                </button>
              )}
            </div>
          </div>
          {isMyComment && (
            <button type="button" onClick={deleteClick} className="cursor-pointer font-['Tajawal'] text-xs text-[#7A2E2E] flex-shrink-0">
              حذف
            </button>
          )}
        </div>

        {isReplyingHere && (
          <div className="flex gap-2 mt-2 mr-6">
            <input
              type="text"
              value={replyInput}
              onChange={replyInputChange}
              placeholder="اكتب رداً..."
              className="flex-1 px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#1B1A17]"
            />
            <button type="button" onClick={submitReply} className="cursor-pointer px-3 py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-xs">
              إرسال
            </button>
          </div>
        )}

        {replies.map(function (r) {
          return renderComment(r, postId, true)
        })}
      </div>
    )
  }

  function renderModal() {
    if (!openPost) return null

    const p = openPost
    const pType = p.postSource === 'question' ? 'question' : 'story'
    const attributionLabel = getAttributionLabel(p)
    const topLevelComments = getTopLevelComments(p.id)

    function closeModal() {
      setOpenPost(null)
      setReplyingToId(null)
    }

    function stopPropagation(e: React.MouseEvent) {
      e.stopPropagation()
    }

    function commentInputChange(e: React.ChangeEvent<HTMLInputElement>) {
      setCommentInput(e.target.value)
    }

    function submitComment() {
      handleAddComment(p.id)
    }

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={closeModal}>
        <div className="bg-white rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={stopPropagation}>
          <div className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#1B1A17] flex items-center justify-center text-[#AD8A4E] font-['Amiri'] text-lg flex-shrink-0">
                  {attributionLabel.charAt(0)}
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">{attributionLabel}</p>
                  {isTopContributor(p) && (
                    <span className="text-xs" title="أحد أكثر المساهمين نشاطاً">🏆</span>
                  )}
                </div>
              </div>
              <button type="button" onClick={closeModal} className="cursor-pointer font-['Tajawal'] text-[#4A473F] text-xl leading-none">×</button>
            </div>

            {p.title && <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-2">{p.title}</h3>}
            <p className="font-['Tajawal'] text-sm text-[#4A473F] whitespace-pre-wrap mb-3">{renderTextWithHashtags(p.body)}</p>

            {p.image_url && (
              <img src={p.image_url} alt="" className="w-full rounded-md mb-3 object-cover" />
            )}
          </div>

          {renderActionsBar(p, pType)}

          <div className="p-5">
            <h4 className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-3">التعليقات</h4>

            {topLevelComments.length === 0 && (
              <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-3">لا توجد تعليقات بعد</p>
            )}

            {topLevelComments.map(function (c) {
              return renderComment(c, p.id, false)
            })}

            <div className="flex gap-2 mt-3">
              <input
                type="text"
                value={commentInput}
                onChange={commentInputChange}
                placeholder="أضف تعليقاً..."
                className="flex-1 px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#1B1A17]"
              />
              <button type="button" onClick={submitComment} disabled={commentSubmitting} className="cursor-pointer px-3 py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-xs">
                إرسال
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>
      </div>
    )
  }

  if (notAllowed) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات المحامين والمكاتب فقط</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  if (notSubscribed) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-8">
            <h1 className="font-['Amiri'] text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى المجتمع</h1>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed mb-6">
              يرجى الاشتراك في إحدى الباقات المتاحة للوصول إلى المجتمع.
            </p>
            <a href="/subscription" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">
              عرض خطط الاشتراك
            </a>
          </div>
        </div>
      </div>
    )
  }

  const infoLink = myIdentity && myIdentity.type === 'firm' ? '/firm-info' : '/lawyer-info'
  const footerVariant: 'lawyer' | 'firm' = myIdentity && myIdentity.type === 'firm' ? 'firm' : 'lawyer'

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/">
              <img src="/logo.png" alt="حمورابي" className="h-12 w-auto" />
            </a>
            <div className="flex gap-5 items-center">
              {footerVariant === 'firm' && (
                <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">لوحة التحكم</a>
              )}
              {footerVariant === 'lawyer' && (
                <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              )}
              {footerVariant === 'firm' && (
                <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              )}
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/community" className="text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition">
                <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                {totalUnread > 0 && (
                  <span className="absolute -top-2 -left-2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{totalUnread}</span>
                )}
              </a>
              <div className="relative" ref={menuRef}>
                <button onClick={toggleMenu} className="relative w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                  {pendingConsultations > 0 && (
                    <span className="absolute -top-1 -left-1 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/subscription" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">ترقية الاشتراك</a>
                    <a href={infoLink} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">معلوماتي الشخصية</a>
                    <a href="/lawyer-history" className="relative block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                      المواعيد والاستشارات
                      {pendingConsultations > 0 && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                      )}
                    </a>                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">مجتمع المحامين</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">هذا مجتمعك — شارك فكرة، اطرح سؤالاً على زملائك، أو أخبرنا بشيء تفخر به اليوم</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 flex-1 w-full">
        <input
          type="text"
          value={searchTerm}
          onChange={function (e) { setSearchTerm(e.target.value) }}
          placeholder="ابحث باسم محامي أو مكتب أو كلمة مفتاحية أو وسم..."
          className="w-full px-4 py-2.5 mb-6 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
        />

        {!composeOpen && (
          <button
            type="button"
            onClick={function () { setComposeOpen(true) }}
            className="cursor-pointer w-full flex items-center gap-3 bg-white border border-[#D8D2C4] rounded-lg p-4 mb-6 text-right hover:border-[#AD8A4E] transition"
          >
            <span className="w-9 h-9 rounded-full bg-[#AD8A4E] text-white flex items-center justify-center text-xl flex-shrink-0">+</span>
            <span className="font-['Tajawal'] text-sm text-[#4A473F]">بم تفكر اليوم؟</span>
          </button>
        )}

        {composeOpen && (
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6">
            <textarea
              value={composeText}
              onChange={function (e) { setComposeText(e.target.value) }}
              rows={4}
              placeholder="شارك فكرة، سؤالاً، أو إنجازاً تفخر به... استخدم # لإضافة وسم مثل #قانون_عمل"
              className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {!composeImagePreview && (
              <button
                type="button"
                onClick={triggerFileInput}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#4A473F] hover:bg-[#D8D2C4] transition"
              >
                📷 إضافة صورة (اختياري)
              </button>
            )}

            {composeImagePreview && (
              <div className="relative mb-3 inline-block">
                <img src={composeImagePreview} alt="معاينة" className="max-h-48 rounded-md" />
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  className="cursor-pointer absolute -top-2 -left-2 w-6 h-6 bg-[#7A2E2E] text-white rounded-full flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={function () { setComposeOpen(false); setComposeText(''); removeSelectedImage() }}
                className="cursor-pointer flex-1 py-3 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handlePost}
                disabled={posting}
                className="cursor-pointer flex-1 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60"
              >
                {posting ? 'جاري النشر...' : 'نشر'}
              </button>
            </div>
          </div>
        )}

        {actionMessage && (
          <p className="font-['Tajawal'] text-sm text-[#7A2E2E] mb-4">{actionMessage}</p>
        )}

        {filteredPosts.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد منشورات مطابقة</p>
        )}

        {filteredPosts.map(renderPost)}
      </div>

      {renderModal()}

      <Footer variant={footerVariant} />
    </div>
  )
}