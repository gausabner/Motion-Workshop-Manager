from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from core.database import get_db_session
from models.invoice import Invoice, InvoiceLineItem
from schemas.invoice import (
    InvoiceCreate, InvoiceResponse, InvoiceUpdate,
    InvoiceLineItemCreate, InvoiceLineItemResponse
)

router = APIRouter(prefix="/invoices", tags=["invoices"])

def calculate_invoice_totals(invoice: Invoice, items: List[InvoiceLineItem]):
    subtotal = 0.0
    total_tax = 0.0
    for item in items:
        # Business logic for a single item calculation
        item.tax_amount = (item.quantity * item.unit_price) * item.tax_rate
        item.line_total = (item.quantity * item.unit_price) + item.tax_amount
        
        subtotal += (item.quantity * item.unit_price)
        total_tax += item.tax_amount

    invoice.subtotal = subtotal
    invoice.total_tax = total_tax
    invoice.total_amount = subtotal + total_tax

@router.post("/", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(invoice: InvoiceCreate, db: AsyncSession = Depends(get_db_session)):
    db_invoice = Invoice(**invoice.model_dump())
    db.add(db_invoice)
    await db.commit()
    await db.refresh(db_invoice)
    return db_invoice

@router.get("/", response_model=List[InvoiceResponse])
async def list_invoices(tenant_id: UUID, db: AsyncSession = Depends(get_db_session)):
    query = select(Invoice).where(Invoice.tenant_id == tenant_id).options(selectinload(Invoice.line_items))
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: UUID, db: AsyncSession = Depends(get_db_session)):
    query = select(Invoice).where(Invoice.id == invoice_id).options(selectinload(Invoice.line_items))
    result = await db.execute(query)
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@router.post("/{invoice_id}/items", response_model=InvoiceLineItemResponse, status_code=status.HTTP_201_CREATED)
async def add_invoice_item(invoice_id: UUID, item: InvoiceLineItemCreate, db: AsyncSession = Depends(get_db_session)):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    db_item = InvoiceLineItem(**item.model_dump(), invoice_id=invoice_id)
    db.add(db_item)
    
    # Recalculate totals for the invoice including the new item
    # Need to load all existing items first
    query = select(InvoiceLineItem).where(InvoiceLineItem.invoice_id == invoice_id)
    result = await db.execute(query)
    existing_items = list(result.scalars().all())
    existing_items.append(db_item)
    
    calculate_invoice_totals(invoice, existing_items)
    
    await db.commit()
    await db.refresh(db_item)
    return db_item
