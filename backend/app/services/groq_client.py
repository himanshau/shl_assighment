import os

from groq import Groq

from dotenv import load_dotenv

load_dotenv()


client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)


def generate_reply(
    query: str,
    recommendations: list,
    *,
    voice: bool = False,
    latest_user_message: str = "",
):

    recommendation_text = ""

    for rec in recommendations:

        recommendation_text += f"""
        Name: {rec['name']}
        Type: {rec['test_type']}
        URL: {rec['url']}
        """


    prompt = f"""
    You are an SHL assessment recommendation assistant.

    STRICT RULES:
    - ONLY talk about assessments provided below.
    - NEVER invent assessments.
    - NEVER mention assessments not in the recommendation list.
    - NEVER invent or assume hiring requirements the user did not state.
    - If the conversation lacks role/seniority/skills, ask a short clarifying question instead of guessing.
    - Keep response concise.
    - Use recruiter-friendly language.
    - Maximum {"60" if voice else "120"} words.
    - {"Use plain spoken English only — NO markdown, NO asterisks, NO numbered lists." if voice else "Sound conversational and natural."}
    - {"Give at most 3 assessments in flowing sentences." if voice else ""}
    - {"Answer ONLY the latest user request. Do not repeat recommendations for earlier roles in this reply." if voice and latest_user_message else ""}

    Conversation:
    {query}

    {"Latest user request (answer this only): " + latest_user_message if voice and latest_user_message else ""}

    Recommended Assessments:
    {recommendation_text}

    Explain briefly why these assessments fit the hiring requirement.
    """


    completion = client.chat.completions.create(

        model="llama-3.1-8b-instant",

        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],

        temperature=0.3
    )

    return completion.choices[0].message.content


def generate_clarification_reply(conversation: str) -> str:
    prompt = f"""
    You are an SHL assessment hiring assistant having a short voice conversation.

    Ask ONE friendly follow-up question to clarify what is still missing
    (usually seniority level, key skills, or whether personality/aptitude is needed).
    Do not recommend assessments yet. Keep it under 35 words.

    CRITICAL:
    - Do NOT invent or restate hiring requirements the user never mentioned.
    - Do NOT say "we are hiring for..." unless the user explicitly said that.
    - If the user's last message was unclear, ask them to repeat the role and seniority.

    Conversation:
    {conversation}
    """

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    return completion.choices[0].message.content


def generate_comparison_reply(conversation: str, docs: list) -> str:
    catalog_context = ""
    for doc in docs:
        catalog_context += f"""
        Name: {doc.metadata.get('name', '')}
        Categories: {doc.metadata.get('keys', '')}
        URL: {doc.metadata.get('url', '')}
        Description: {doc.page_content[:400]}
        """

    prompt = f"""
    You are an SHL assessment assistant. Compare ONLY the assessments below using catalog facts.
    NEVER invent assessments or facts not present below.
    Keep the answer concise (max 120 words) and recruiter-friendly.

    Conversation:
    {conversation}

    Catalog assessments:
    {catalog_context}
    """

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    return completion.choices[0].message.content