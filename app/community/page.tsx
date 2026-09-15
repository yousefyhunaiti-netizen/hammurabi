'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase'

type Post = {
  postSource: string
  id: number
  lawyer_id: number
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
  lawyer_id: number
}

type Repost = {
  post_type: string
  post_id: number
  lawyer_id: number
}

type Comment = {
  id: number
  story_id: number
  lawyer_id: number
  body: string
  created_at: string
  parent_comment_id: number | null
}

export default function CommunityPage() {
  const [loading, setLoading] = useState(true)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [lawyerId, setLawyerId] = useState<number | null>(null)

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

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function loadFeed() {
    const questionsResult = await supabase.from('community_questions').select('id, lawyer_id, title, body, created_at').order('created_at', { ascending: false })
    const storiesResult = await supabase.from('success_stories').select('id, lawyer_id, title, body, image_url, created_at').order('created_at', { ascending: false })

    const qData = (questionsResult.data || []).map(function (q: any) {
      return { postSource: 'question', id: q.id, lawyer_id: q.lawyer_id, title: q.title, body: q.body, created_at: q.created_at }
    })
    const sData = (storiesResult.data || []).map(function (s: any) {
      return { postSource: 'story', id: s.id, lawyer_id: s.lawyer_id, title: s.title, body: s.body, image_url: s.image_url, created_at: s.created_at }
    })

    const allPosts = qData.concat(sData).sort(function (a: Post, b: Post) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    setPosts(allPosts)

    const lawyerIds = Array.from(new Set(allPosts.map(function (p: Post) { return p.lawyer_id })))
    let lawyersData: LawyerInfo[] = []
    if (lawyerIds.length > 0) {
      const namesResult = await supabase.from('lawyers').select('id, full_name, firm_id').in('id', lawyerIds)
      lawyersData = namesResult.data || []
      setLawyerInfos(lawyersData)
    }

    const firmIds = Array.from(new Set(lawyersData.map(function (l) { return l.firm_id }).filter(Boolean)))
    if (firmIds.length > 0) {
      const firmsResult = await supabase.from('firms').select('id, firm_name, show_lawyer_names').in('id', firmIds)
      setFirms(firmsResult.data || [])
    }

    const likesResult = await supabase.from('post_likes').select('post_type, post_id, lawyer_id')
    setLikes(likesResult.data || [])

    const repostsResult = await supabase.from('reposts').select('post_type, post_id, lawyer_id')
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
        .select('id, is_active, is_comped')
        .eq('user_id', userResult.data.user.id)
        .maybeSingle()

      if (!lawyerResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      if (!lawyerResult.data.is_active && !lawyerResult.data.is_comped) {
        setNotSubscribed(true)
        setLoading(false)
        return
      }

      setLawyerId(lawyerResult.data.id)

      await loadFeed()
      setLoading(false)
    }

    loadData()
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
    if (!composeText.trim() || !lawyerId) return
    setPosting(true)
    setActionMessage('')

    let imageUrl = ''
    if (composeImageFile) {
      const filePath = 'post-' + lawyerId + '-' + Date.now() + '-' + composeImageFile.name
      const uploadResult = await supabase.storage.from('post-images').upload(filePath, composeImageFile)

      if (uploadResult.error) {
        setPosting(false)
        setActionMessage('حدث خطأ أثناء رفع الصورة: ' + uploadResult.error.message)
        return
      }

      const urlResult = supabase.storage.from('post-images').getPublicUrl(filePath)
      imageUrl = urlResult.data.publicUrl
    }

    const insertResult = await supabase.from('success_stories').insert({
      lawyer_id: lawyerId,
      title: '',
      body: composeText,
      image_url: imageUrl || null,
    })

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
    if (!lawyerId) return
    setActionMessage('')

    const existing = likes.find(function (l) { return l.post_type === pType && l.post_id === postId && l.lawyer_id === lawyerId })

    if (existing) {
      await supabase.from('post_likes').delete().eq('post_type', pType).eq('post_id', postId).eq('lawyer_id', lawyerId)
    } else {
      await supabase.from('post_likes').insert({ post_type: pType, post_id: postId, lawyer_id: lawyerId })
    }

    await loadFeed()
  }

  async function handleRepost(pType: string, postId: number) {
    if (!lawyerId) return
    setActionMessage('')

    const existing = reposts.find(function (r) { return r.post_type === pType && r.post_id === postId && r.lawyer_id === lawyerId })

    if (existing) {
      await supabase.from('reposts').delete().eq('post_type', pType).eq('post_id', postId).eq('lawyer_id', lawyerId)
    } else {
      await supabase.from('reposts').insert({ post_type: pType, post_id: postId, lawyer_id: lawyerId })
    }

    await loadFeed()
  }

  async function handleAddComment(postId: number) {
    if (!commentInput.trim() || !lawyerId) return
    setCommentSubmitting(true)

    await supabase.from('story_comments').insert({
      story_id: postId,
      lawyer_id: lawyerId,
      body: commentInput,
      parent_comment_id: null,
    })

    setCommentInput('')
    setCommentSubmitting(false)
    await loadFeed()
  }

  async function handleAddReply(postId: number, parentId: number) {
    if (!replyInput.trim() || !lawyerId) return

    await supabase.from('story_comments').insert({
      story_id: postId,
      lawyer_id: lawyerId,
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

  function getAttributionLabel(lawyerId: number) {
    const lawyer = lawyerInfos.find(function (l) { return l.id === lawyerId })
    if (!lawyer) return ''

    if (lawyer.firm_id) {
      const firm = firms.find(function (f) { return f.id === lawyer.firm_id })
      if (firm) {
        if (firm.show_lawyer_names) {
          return firm.firm_name + ' — ' + lawyer.full_name
        }
        return firm.firm_name
      }
    }

    return lawyer.full_name
  }

  function getLikeCount(pType: string, postId: number) {
    return likes.filter(function (l) { return l.post_type === pType && l.post_id === postId }).length
  }

  function isLikedByMe(pType: string, postId: number) {
    if (!lawyerId) return false
    return likes.some(function (l) { return l.post_type === pType && l.post_id === postId && l.lawyer_id === lawyerId })
  }

  function getRepostCount(pType: string, postId: number) {
    return reposts.filter(function (r) { return r.post_type === pType && r.post_id === postId }).length
  }

  function isRepostedByMe(pType: string, postId: number) {
    if (!lawyerId) return false
    return reposts.some(function (r) { return r.post_type === pType && r.post_id === postId && r.lawyer_id === lawyerId })
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
    const scoreMap: { [key: number]: number } = {}
    posts.forEach(function (p) {
      scoreMap[p.lawyer_id] = (scoreMap[p.lawyer_id] || 0) + 1
    })
    const entries = Object.entries(scoreMap).sort(function (a, b) { return b[1] - a[1] })
    return entries.slice(0, 3).map(function (e) { return Number(e[0]) })
  }

  const topContributorIds = getTopContributorIds()

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
    const authorName = getAttributionLabel(p.lawyer_id).toLowerCase()
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
    const attributionLabel = getAttributionLabel(p.lawyer_id)
    const isTopContributor = topContributorIds.indexOf(p.lawyer_id) !== -1
    const isMine = p.lawyer_id === lawyerId
    const postKey = pType + '-' + p.id
    const menuOpen = menuOpenPostKey === postKey

    function cardClick() {
      setOpenPost(p)
    }

    function menuButtonClick(e: React.MouseEvent) {
      e.stopPropagation()
      setMenuOpenPostKey(menuOpen ? null : postKey)
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
                {isTopContributor && (
                  <span className="text-xs" title="أحد أكثر المساهمين نشاطاً">🏆</span>
                )}
              </div>
            </div>

            {isMine && (
              <div className="relative">
                <button type="button" onClick={menuButtonClick} className="cursor-pointer text-[#4A473F] px-2">⋮</button>
                {menuOpen && (
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
    const isMyComment = c.lawyer_id === lawyerId
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
            <p className="font-['Tajawal'] text-xs font-bold text-[#1B1A17]">{getAttributionLabel(c.lawyer_id)}</p>
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
    const attributionLabel = getAttributionLabel(p.lawyer_id)
    const isTopContributor = topContributorIds.indexOf(p.lawyer_id) !== -1
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
                  {isTopContributor && (
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
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات المحامين فقط</p>
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
              يرجى الاشتراك في إحدى الباقات المتاحة للوصول إلى مجتمع المحامين.
            </p>
            <a href="/subscription" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">
              عرض خطط الاشتراك
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/">
              <img src="/logo.png" alt="حمورابي" className="h-12 w-auto" />
            </a>
            <div className="flex gap-5 items-center">
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              <a href="/lawyer-messages" className="hover:text-[#AD8A4E] transition">الرسائل</a>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">مجتمع المحامين</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">هذا مجتمعك — شارك فكرة، اطرح سؤالاً على زملائك، أو أخبرنا بشيء تفخر به اليوم</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <input
          type="text"
          value={searchTerm}
          onChange={function (e) { setSearchTerm(e.target.value) }}
          placeholder="ابحث باسم محامٍ أو كلمة مفتاحية أو وسم... (النتائج تظهر أثناء الكتابة)"
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
    </div>
  )
}